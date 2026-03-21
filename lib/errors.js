/**
 * Application error with HTTP status code and optional machine-readable error code.
 * Thrown by route handlers and caught by the error middleware.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} status - HTTP status code (default 500)
   * @param {string} [code] - Machine-readable error code (e.g. 'DUPLICATE_USERNAME')
   */
  constructor(message, status = 500, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Handles database errors, detecting common SQLite constraint violations.
 * Returns a user-friendly AppError for known cases, or a generic 500 for unknown ones.
 *
 * @param {Error} err - The caught database error
 * @param {{ uniqueMessage?: string }} [options] - Custom message for UNIQUE violations
 * @returns {AppError} An AppError ready to be sent as a response
 */
function handleDbError(err, options = {}) {
  if (err.message && err.message.includes('UNIQUE')) {
    return new AppError(
      options.uniqueMessage || 'A record with that value already exists',
      400,
      'DUPLICATE',
    );
  }
  console.error('Database error:', err.message);
  return new AppError('Server error', 500, 'DB_ERROR');
}

/**
 * Express error-handling middleware. Catches AppError instances and sends
 * a consistent JSON response. Unknown errors become 500s.
 */
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { AppError, handleDbError, errorHandler };
