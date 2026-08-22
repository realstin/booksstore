const rateLimit = require('express-rate-limit');

// API rate limiter — applied to all general API routes:
// /api/stats, /api/books, /api/users, /api/bookmarks, /api/notes.
//
// Stricter than the global limiter. PDF streaming paths are skipped
// here because they are handled by pdfStreamLimiter instead.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.endsWith('/pdf'),
});

module.exports = apiLimiter;
