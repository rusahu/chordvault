const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, stmts, isRegistrationAllowed } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { validateUserCredentials } = require('../lib/validation');
const { ROLES, LIMITS } = require('../lib/constants');
const { handleDbError } = require('../lib/errors');
const { DEMO_MODE, blockInDemo } = require('../lib/demo');

const JWT_SECRET = process.env.JWT_SECRET;

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  });
  const data = await res.json();
  return data.success === true;
}

function createAuthRouter({ withSkipGlobal, authLimiter, registerLimiter }) {
  const router = express.Router();

  router.get('/config', (req, res) => {
    const userCount = stmts.countUsers.get().count;
    const hasInvites = db.prepare("SELECT COUNT(*) as count FROM invites WHERE used_at IS NULL").get().count > 0;
    res.json({ allowRegistration: isRegistrationAllowed() || userCount === 0, invitesEnabled: hasInvites, turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null, demoMode: DEMO_MODE });
  });

  router.post('/register', withSkipGlobal(registerLimiter), async (req, res) => {
    const userCount = stmts.countUsers.get().count;
    if (DEMO_MODE && userCount > 0) {
      return res.status(403).json({ error: 'Disabled in demo mode' });
    }
    if (!isRegistrationAllowed() && userCount > 0) {
      return res.status(403).json({ error: 'Registration is currently disabled' });
    }

    const { username, password, turnstile_token } = req.body;
    if (!(await verifyTurnstile(turnstile_token))) {
      return res.status(400).json({ error: 'Bot verification failed. Please try again.' });
    }
    const credentialsErr = validateUserCredentials(username, password);
    if (credentialsErr) return res.status(400).json({ error: credentialsErr });

    const isFirstUser = userCount === 0;
    const role = isFirstUser ? ROLES.OWNER : ROLES.USER;
    const hash = await bcrypt.hash(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, role);
      const token = jwt.sign({ id: result.lastInsertRowid, username: username.trim() }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, id: result.lastInsertRowid, username: username.trim(), role });
    } catch (e) {
      const appErr = handleDbError(e, { uniqueMessage: 'Username already taken' });
      return res.status(appErr.status).json({ error: appErr.message });
    }
  });

  router.post('/login', withSkipGlobal(authLimiter), async (req, res) => {
    const { username, password } = req.body;
    const user = stmts.getUserByUsername.get(username?.trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (user.disabled) {
      return res.status(403).json({ error: 'Account is disabled. Contact an administrator.' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, id: user.id, username: user.username, role: user.role });
  });

  router.post('/redeem-invite', blockInDemo, withSkipGlobal(registerLimiter), async (req, res) => {
    const { code, username, password, turnstile_token } = req.body;
    if (!(await verifyTurnstile(turnstile_token))) {
      return res.status(400).json({ error: 'Bot verification failed. Please try again.' });
    }
    if (!code?.trim()) return res.status(400).json({ error: 'Invite code is required' });
    const credentialsErr = validateUserCredentials(username, password);
    if (credentialsErr) return res.status(400).json({ error: credentialsErr });

    const invite = db.prepare("SELECT * FROM invites WHERE code = ? AND used_at IS NULL").get(code.trim());
    if (!invite) return res.status(400).json({ error: 'Invalid or already used invite code' });

    const hash = await bcrypt.hash(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, ROLES.USER);
      db.prepare('UPDATE invites SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(result.lastInsertRowid, invite.id);
      const token = jwt.sign({ id: result.lastInsertRowid, username: username.trim() }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, id: result.lastInsertRowid, username: username.trim(), role: ROLES.USER });
    } catch (e) {
      const appErr = handleDbError(e, { uniqueMessage: 'Username already taken' });
      return res.status(appErr.status).json({ error: appErr.message });
    }
  });

  router.put('/password', blockInDemo, requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current password and new password are required' });
    if (new_password.length < LIMITS.PASSWORD_MIN) return res.status(400).json({ error: `New password must be at least ${LIMITS.PASSWORD_MIN} characters` });
    const user = stmts.getFullUserById.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAuthRouter };
