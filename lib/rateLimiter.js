const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { resolveAuth } = require('./auth');

const exitPolicyRouter = (_req, _res, next) => next('router');

function createLimiter(limit, windowMs) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });
}

function createApiRateLimiter() {
  const router = express.Router();
  const registration = createLimiter(5, 3_600_000);
  const write = createLimiter(50, 60_000);
  const read = createLimiter(200, 60_000);
  const publicRead = createLimiter(60, 60_000);
  const publicBurst = createLimiter(10, 5_000);

  router.use((_req, _res, next) => {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'test') return next('router');
    next();
  });
  router.post('/auth/login', createLimiter(15, 900_000), exitPolicyRouter);
  router.post(['/auth/register', '/auth/redeem-invite'], registration, exitPolicyRouter);
  router.get('/songs/export', createLimiter(5, 60_000), exitPolicyRouter);
  router.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) return write(req, res, next);
    if (resolveAuth(req).user) return read(req, res, next);
    return publicBurst(req, res, (err) => {
      if (err) return next(err);
      return publicRead(req, res, next);
    });
  });
  return router;
}

module.exports = { createApiRateLimiter };
