const rateLimit = require('express-rate-limit');

// PDF stream limiter — applied only to /api/books/:id/pdf.
//
// PDF.js fetches a book in many small HTTP range requests (typically
// 10–50 per open). A ceiling of 500 per 15 minutes comfortably supports
// 10–50 book opens per window for a single IP while still blocking
// clearly abusive clients.
//
// This limiter is mounted before the generic /api/books mount in
// server.js so it wins over apiLimiter for the PDF path.
const pdfStreamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many PDF requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = pdfStreamLimiter;
