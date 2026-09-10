// Middleware to verify JWT token from HTTP-only cookie and protect routes

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {

  // ── 1. Extract token from cookie ──────────────────────────────────────────
  const token = req.cookies.bookstowa_token;

  if (!token) {
    return res.status(401).json({
      message: 'No token provided. Please login first.'
    });
  }

  // ── 2. Verify signature & expiry ──────────────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ message: 'Invalid token. Please login again.' });
  }

  // ── 3. Confirm the account still exists in the database ───────────────────
  // We fetch the full user document so req.user always reflects the latest
  // data (name, email, role, avatar) — not a stale snapshot baked into the token.
  try {
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        message: 'Account no longer exists. Please login again.'
      });
    }

    // Expose _id as userId so every controller can use req.user.userId
    // without knowing whether req.user is a plain object or a Mongoose doc.
    req.user        = user;
    req.user.userId = user._id;

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Authentication check failed. Please try again.' });
  }
};

module.exports = authenticate;