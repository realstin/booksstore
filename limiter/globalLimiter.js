const rateLimit = require('express-rate-limit');

// Global rate limiter — applied to every incoming request via app.use().
//
// PDF.js makes 10–50 HTTP range requests per book open, so requests
// that include "/pdf" in the path are skipped here and handled instead
// by pdfStreamLimiter, which has a much higher ceiling.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  skip: (req) => req.path.includes('/pdf'),
});

module.exports = globalLimiter;
