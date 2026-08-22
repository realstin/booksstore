const rateLimit = require('express-rate-limit');

// The tightest limit in the app. Keeps brute-force and
// credential-stuffing attacks within acceptable bounds.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = authLimiter;
