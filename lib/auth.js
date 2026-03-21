const jwt = require('jsonwebtoken');
const { stmts } = require('./db');
const { ROLES } = require('./constants');
const { parseId, isValidDate, validateUserCredentials } = require('./validation');

const JWT_SECRET = process.env.JWT_SECRET;

function isAdminRole(role) {
  return role === ROLES.ADMIN || role === ROLES.OWNER;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = stmts.getUserById.get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'Account is disabled' });
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = stmts.getUserById.get(decoded.id);
      if (user && !user.disabled) {
        req.user = { id: user.id, username: user.username, role: user.role };
      }
    } catch {}
  }
  next();
}

module.exports = {
  ROLES,
  isAdminRole,
  parseId,
  isValidDate,
  validateUserCredentials,
  requireAuth,
  requireAdmin,
  optionalAuth,
};
