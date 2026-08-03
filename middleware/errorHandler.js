/**
 * Global Error Handler Middleware
 * Catches all errors and sends safe responses to client
 */

const errorHandler = (err, req, res, next) => {
  // Log error details on server (safe, only admins see this)
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // ============ NEW: HANDLE DIFFERENT ERROR TYPES ============

  // MongoDB Cast Error (invalid ID format)
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID format'
    });
  }

  // MongoDB Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
    return res.status(400).json({
      message: `Validation failed: ${messages}`
    });
  }

  // Duplicate Key Error (e.g., ISBN already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      message: `A book with this ${field} already exists`
    });
  }

  // JWT/Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid or expired authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Default: Send generic error message to client
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Something went wrong. Please try again later.' : err.message;

  return res.status(statusCode).json({
    message: message
  });

  // ============ END ERROR HANDLING ============
};

module.exports = errorHandler;