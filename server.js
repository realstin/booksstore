const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const bookRoutes = require('./routes/books');
const userRoutes = require('./routes/users');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
const authRoutes = require("./routes/auth");
const PORT =process.env.PORT;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://bookstowa.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ============ NEW: RATE LIMITING ============

// Global rate limiter (applies to all requests)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// API-specific rate limiter (stricter for sensitive endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 API requests per 15 minutes
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (very strict for login/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global limiter to all requests
app.use(globalLimiter);

// ============ END RATE LIMITING ============

// Routes
app.use("/api/auth", authLimiter, authRoutes); // Stricter for auth
app.use('/api/books', apiLimiter, bookRoutes); // Strict for API
app.use('/api/users', apiLimiter, userRoutes); // Strict for API

//  Error Handler (must be last)
app.use(errorHandler);


//  Server 
const startServer = async () => {
  
  // Database
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();