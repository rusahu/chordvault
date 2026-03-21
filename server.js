const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { db } = require('./lib/db');
const { createAuthRouter } = require('./routes/auth');
const { createSongsRouter } = require('./routes/songs');
const { createSetlistsRouter } = require('./routes/setlists');
const { createAdminRouter } = require('./routes/admin');
const { createSettingsRouter } = require('./routes/settings');
const { errorHandler } = require('./lib/errors');

const app = express();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Set it in your .env file.');
  process.exit(1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://challenges.cloudflare.com"],
    }
  }
}));

app.set('trust proxy', 1);

/**
 * Creates an in-memory, IP-based rate limiter middleware.
 * Tracks request timestamps per IP and rejects with 429 when the limit is exceeded.
 * A cleanup interval runs every 60s to evict expired entries from memory.
 *
 * @param {number} maxRequests - Maximum allowed requests per window
 * @param {number} windowMs - Sliding window duration in milliseconds
 * @returns {function} Express middleware that enforces the rate limit
 */
function createRateLimiter(maxRequests, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) hits.delete(ip);
      else hits.set(ip, valid);
    }
  }, 60_000);

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

const authLimiter = createRateLimiter(15, 15 * 60 * 1000);
const registerLimiter = createRateLimiter(5, 60 * 60 * 1000);
const writeLimiter = createRateLimiter(50, 60 * 1000);
const readLimiter = createRateLimiter(200, 60 * 1000);
const publicReadLimiter = createRateLimiter(60, 60 * 1000);
const publicBurstLimiter = createRateLimiter(10, 5 * 1000);

/**
 * Wraps a route-specific limiter so the global `/api/` rate limiter skips it.
 * Sets `req._rateLimited = true` which the global middleware checks before
 * applying its own limits. Used for auth routes that need stricter, independent limits.
 *
 * @param {function} limiter - A rate limiter middleware created by createRateLimiter
 * @returns {function} Express middleware that applies the limiter and flags the request
 */
function withSkipGlobal(limiter) {
  return (req, res, next) => {
    req._rateLimited = true;
    limiter(req, res, next);
  };
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', (req, res, next) => {
  if (req._rateLimited) return next();
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return publicBurstLimiter(req, res, () => publicReadLimiter(req, res, next));
  }
  return readLimiter(req, res, next);
});

app.use('/api/auth', createAuthRouter({
  withSkipGlobal,
  authLimiter,
  registerLimiter,
}));
app.use('/api', createSongsRouter());
app.use('/api', createSetlistsRouter());
app.use('/api', createAdminRouter());
app.use('/api', createSettingsRouter());

app.use(errorHandler);

const PORT = process.env.PORT || 3100;
const server = app.listen(PORT, () => console.log(`ChordVault running on port ${PORT}`));

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  const forceExit = setTimeout(() => { db.close(); process.exit(1); }, 5000);
  server.close(() => {
    clearTimeout(forceExit);
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
