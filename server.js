const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const bookRoutes = require('./routes/books');
const userRoutes = require('./routes/users');
const bookmarkRoutes = require('./routes/bookmarks');
const noteRoutes = require('./routes/notes');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
const authRoutes = require("./routes/auth");
const PORT = process.env.PORT;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://bookstowa.vercel.app",
    ],
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Global rate limiter — applies to all requests except PDF streaming.
// PDF.js makes many HTTP range requests per book open; exempting /pdf
// prevents a single reading session from exhausting the global budget.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.includes('/pdf'),
});

// API rate limiter — stricter limit for general API calls.
// Skips the PDF streaming endpoint for the same reason as above.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.endsWith('/pdf'),
});

// Auth rate limiter — very strict, login/signup/google only.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// PDF streaming limiter — generous limit to accommodate PDF.js range requests.
// A typical book open triggers 10–50 range requests. 500 per 15 min allows
// roughly 10–50 book opens per window while still blocking abusive clients.
const pdfStreamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many PDF requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global limiter to all requests (PDF endpoint is skipped via `skip`)
app.use(globalLimiter);

// Routes
app.use("/api/auth", authLimiter, authRoutes);

// PDF stream route — registered with its own limiter before the generic
// /api/books mount so PDF.js range requests are not blocked by apiLimiter.
app.use('/api/books/:id/pdf', pdfStreamLimiter);

app.use('/api/books', apiLimiter, bookRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/bookmarks', apiLimiter, bookmarkRoutes);
app.use('/api/notes', apiLimiter, noteRoutes);

// Error Handler (must be last)
app.use(errorHandler);

// Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
