const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const bookRoutes     = require('./routes/books');
const userRoutes     = require('./routes/users');
const bookmarkRoutes = require('./routes/bookmarks');
const noteRoutes     = require('./routes/notes');
const statsRoutes    = require('./routes/stats');

// ── Middleware ────────────────────────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

// ── Limiters ──────────────────────────────────────────────────────────────────
const globalLimiter    = require('./limiter/globalLimiter');
const apiLimiter       = require('./limiter/apiLimiter');
const authLimiter      = require('./limiter/authLimiter');
const pdfStreamLimiter = require('./limiter/pdfStreamLimiter');

// ── Config ────────────────────────────────────────────────────────────────────
const connectDB = require('./config/database');
const PORT = process.env.PORT || 3000;

// ── Core Middleware ───────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://bookstowa.vercel.app',
    ],
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(globalLimiter);

// ── Route Mounts ──────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);

// PDF stream route must be mounted before the generic /api/books mount so
// pdfStreamLimiter wins over apiLimiter for the PDF path.
app.use('/api/books/:id/pdf', pdfStreamLimiter);

app.use('/api/stats',     apiLimiter, statsRoutes);
app.use('/api/books',     apiLimiter, bookRoutes);
app.use('/api/users',     apiLimiter, userRoutes);
app.use('/api/bookmarks', apiLimiter, bookmarkRoutes);
app.use('/api/notes',     apiLimiter, noteRoutes);

// ── Error Handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
