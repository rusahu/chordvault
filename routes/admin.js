const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, stmts, setSetting, isRegistrationAllowed, deleteUserTransaction } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../lib/auth');
const { parseId, validateUserCredentials } = require('../lib/validation');
const { handleDbError } = require('../lib/errors');
const { ROLES, STATUS } = require('../lib/constants');
const { blockInDemo } = require('../lib/demo');

function resolveAdminTarget(req, res) {
  const targetId = parseId(req.params.id);
  if (!targetId) { res.status(400).json({ error: 'Invalid user ID' }); return null; }
  const target = stmts.getFullUserById.get(targetId);
  if (!target) { res.status(404).json({ error: 'User not found' }); return null; }
  if (target.role === ROLES.OWNER) { res.status(403).json({ error: 'Cannot modify the owner' }); return null; }
  if (target.role === ROLES.ADMIN && req.user.role !== ROLES.OWNER) {
    res.status(403).json({ error: 'Only the owner can manage admins' });
    return null;
  }
  if (targetId === req.user.id) { res.status(403).json({ error: 'Cannot modify yourself' }); return null; }
  return { targetId, target };
}

function createAdminRouter() {
  const router = express.Router();

  router.get('/admin/stats', requireAuth, requireAdmin, (req, res) => {
    const userCount = stmts.countUsers.get().count;
    const songCount = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;
    const pendingCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE status = ?').get(STATUS.PENDING).count;
    const recentUsers = db.prepare('SELECT id, username, role, disabled, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
    const recentSongs = db.prepare(`
      SELECT s.id, s.title, s.artist, s.visibility, s.created_at, u.username
      FROM songs s JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 5
    `).all();
    const noFormatCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE format_detected IS NULL AND content != \'\' AND status = ?').get(STATUS.ACTIVE).count;
    const languageDistribution = db.prepare(
      "SELECT language, COUNT(*) as count FROM songs WHERE status = ? AND language != '' GROUP BY language ORDER BY count DESC"
    ).all(STATUS.ACTIVE);
    res.json({ userCount, songCount, pendingCount, noFormatCount, languageDistribution, recentUsers, recentSongs });
  });

  router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.disabled, u.created_at,
             COUNT(s.id) as song_count
      FROM users u LEFT JOIN songs s ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `).all();
    res.json(users);
  });

  router.put('/admin/users/:id/role', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { role } = req.body;
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    if ((role === ROLES.ADMIN || resolved.target.role === ROLES.ADMIN) && req.user.role !== ROLES.OWNER) {
      return res.status(403).json({ error: 'Only the owner can promote or demote admins' });
    }
    if (role !== ROLES.USER && role !== ROLES.ADMIN) {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, resolved.targetId);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/disabled', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { disabled } = req.body;
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, resolved.targetId);
    res.json({ success: true });
  });

  router.post('/admin/users', requireAuth, requireAdmin, blockInDemo, async (req, res) => {
    const { username, password } = req.body;
    const credentialsErr = validateUserCredentials(username, password);
    if (credentialsErr) return res.status(400).json({ error: credentialsErr });
    const hash = await bcrypt.hash(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, ROLES.USER);
      res.json({ id: result.lastInsertRowid, username: username.trim() });
    } catch (e) {
      const appErr = handleDbError(e, { uniqueMessage: 'Username already taken' });
      return res.status(appErr.status).json({ error: appErr.message });
    }
  });

  router.delete('/admin/users/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    deleteUserTransaction(resolved.targetId);
    res.json({ success: true });
  });

  router.delete('/admin/songs/:id', requireAuth, requireAdmin, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const result = db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Song not found' });
    res.json({ success: true });
  });

  router.post('/admin/invites', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const code = crypto.randomBytes(8).toString('hex');
    db.prepare('INSERT INTO invites (code, created_by) VALUES (?, ?)').run(code, req.user.id);
    res.json({ code });
  });

  router.get('/admin/invites', requireAuth, requireAdmin, (req, res) => {
    const invites = db.prepare(`
      SELECT i.id, i.code, i.created_at, i.used_at, u.username as created_by_username,
             u2.username as used_by_username
      FROM invites i
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users u2 ON i.used_by = u2.id
      ORDER BY i.created_at DESC LIMIT 50
    `).all();
    res.json(invites);
  });

  router.delete('/admin/invites/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid invite ID' });
    const result = db.prepare('DELETE FROM invites WHERE id = ? AND used_at IS NULL').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Invite not found or already used' });
    res.json({ success: true });
  });

  router.get('/admin/corrections', requireAuth, requireAdmin, (req, res) => {
    const corrections = db.prepare(`
      SELECT c.id, c.title, c.created_at, c.parent_id, u.username as submitter
      FROM songs c JOIN users u ON c.user_id = u.id
      WHERE c.status = ?
      ORDER BY c.created_at ASC
    `).all(STATUS.PENDING);
    res.json(corrections);
  });

  router.get('/admin/config', requireAuth, requireAdmin, (req, res) => {
    res.json({ allowRegistration: isRegistrationAllowed() });
  });

  router.put('/admin/config', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { allowRegistration } = req.body;
    if (typeof allowRegistration !== 'boolean') return res.status(400).json({ error: 'allowRegistration must be a boolean' });
    setSetting('allow_registration', allowRegistration ? '1' : '0');
    res.json({ success: true, allowRegistration });
  });

  return router;
}

module.exports = { createAdminRouter };
