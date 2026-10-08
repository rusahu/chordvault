const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/user');
const { ROLES } = require('./constants');
const { parseId, isValidDate, validateUserCredentials } = require('./validation');

const BCRYPT_ROUNDS = 10;

const JWT_SECRET = process.env.JWT_SECRET;

function isAdminRole(role) {
  return role === ROLES.ADMIN || role === ROLES.OWNER;
}

const AUTH_RESULT = Symbol('authResult');

function resolveAuth(req) {
  if (req[AUTH_RESULT]) return req[AUTH_RESULT];
  const token = req.headers.authorization?.split(' ')[1];
  let result;
  if (!token) {
    result = { status: 401, error: 'Authentication required' };
  } else {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = User.findById(decoded.id);
      result = !user ? { status: 401, error: 'User not found' }
        : user.disabled ? { status: 403, error: 'Account is disabled' }
          : { user: { id: user.id, username: user.username, role: user.role } };
    } catch {
      result = { status: 401, error: 'Invalid or expired token' };
    }
  }
  req[AUTH_RESULT] = result;
  return result;
}

function requireAuth(req, res, next) {
  const result = resolveAuth(req);
  if (!result.user) return res.status(result.status).json({ error: result.error });
  req.user = result.user;
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const result = resolveAuth(req);
  if (result.user) req.user = result.user;
  next();
}

function canManageSong(user, ownerId) {
  return !!user && (user.id === ownerId || isAdminRole(user.role));
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

module.exports = {
  ROLES,
  resolveAuth,
  canManageSong,
  isAdminRole,
  parseId,
  isValidDate,
  validateUserCredentials,
  requireAuth,
  requireAdmin,
  optionalAuth,
  hashPassword,
};
