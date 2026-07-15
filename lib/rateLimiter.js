/**
 * Rate limiting middleware modules for ChordVault.
 * Provides custom sliding-window IP rate limiters to protect auth, read, and write routes.
 */

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
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) hits.delete(ip);
      else hits.set(ip, valid);
    }
  }, 60_000);

  if (interval.unref) {
    interval.unref();
  }

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
const exportLimiter = createRateLimiter(5, 60 * 1000);

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
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'test') return next();
    limiter(req, res, next);
  };
}

/**
 * Global API rate limiter middleware.
 * Checks request method and auth status to apply appropriate limits dynamically.
 */
function apiRateLimiter(req, res, next) {
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'test' || req._rateLimited) return next();
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return publicBurstLimiter(req, res, () => publicReadLimiter(req, res, next));
  }
  return readLimiter(req, res, next);
}

module.exports = {
  authLimiter,
  registerLimiter,
  exportLimiter,
  withSkipGlobal,
  apiRateLimiter,
};
