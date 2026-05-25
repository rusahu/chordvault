const express = require('express');
const crypto = require('crypto');
const { setSetting, isRegistrationAllowed } = require('../lib/db');
const User = require('../lib/models/user');
const Song = require('../lib/models/song');
const Invite = require('../lib/models/invite');
const { requireAuth, requireAdmin, hashPassword } = require('../lib/auth');
const { parseId, validateUserCredentials } = require('../lib/validation');
const { handleDbError } = require('../lib/errors');
const { ROLES, LIMITS } = require('../lib/constants');
const { blockInDemo } = require('../lib/demo');

function resolveAdminTarget(req, res) {
  const targetId = parseId(req.params.id);
  if (!targetId) { res.status(400).json({ error: 'Invalid user ID' }); return null; }
  const target = User.getFullById(targetId);
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
    const userCount = User.count().count;
    const songCount = Song.count();
    const pendingCount = Song.countPending();
    const recentUsers = User.getRecent(5);
    const recentSongs = Song.getRecent(5);
    const noFormatCount = Song.countNoFormat();
    const languageDistribution = Song.getLanguageDistribution();
    res.json({ userCount, songCount, pendingCount, noFormatCount, languageDistribution, recentUsers, recentSongs });
  });

  router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const users = User.listWithSongCount();
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

    User.updateRole(resolved.targetId, role);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/disabled', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { disabled } = req.body;
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    User.updateDisabled(resolved.targetId, disabled);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/password', requireAuth, requireAdmin, blockInDemo, async (req, res) => {
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    const { password } = req.body;
    if (!password || password.length < LIMITS.PASSWORD_MIN) {
      return res.status(400).json({ error: `Password must be at least ${LIMITS.PASSWORD_MIN} characters` });
    }

    const hash = await hashPassword(password);
    User.updatePassword(resolved.targetId, hash);
    res.json({ success: true });
  });

  router.post('/admin/users', requireAuth, requireAdmin, blockInDemo, async (req, res) => {
    const { username, password } = req.body;
    const credentialsErr = validateUserCredentials(username, password);
    if (credentialsErr) return res.status(400).json({ error: credentialsErr });
    const hash = await hashPassword(password);
    try {
      const result = User.create(username.trim(), hash, ROLES.USER);
      res.json({ id: result.lastInsertRowid, username: username.trim() });
    } catch (e) {
      const appErr = handleDbError(e, { uniqueMessage: 'Username already taken' });
      return res.status(appErr.status).json({ error: appErr.message });
    }
  });

  router.delete('/admin/users/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const resolved = resolveAdminTarget(req, res);
    if (!resolved) return;

    User.delete(resolved.targetId);
    res.json({ success: true });
  });

  router.delete('/admin/songs/:id', requireAuth, requireAdmin, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const result = Song.delete(id);
    if (!result.changes) return res.status(404).json({ error: 'Song not found' });
    res.json({ success: true });
  });

  router.post('/admin/invites', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const code = crypto.randomBytes(8).toString('hex');
    Invite.create(code, req.user.id);
    res.json({ code });
  });

  router.get('/admin/invites', requireAuth, requireAdmin, (req, res) => {
    const invites = Invite.list();
    res.json(invites);
  });

  router.delete('/admin/invites/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid invite ID' });
    const result = Invite.deleteUnused(id);
    if (!result.changes) return res.status(404).json({ error: 'Invite not found or already used' });
    res.json({ success: true });
  });

  router.get('/admin/corrections', requireAuth, requireAdmin, (req, res) => {
    const corrections = Song.getPendingCorrections();
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
