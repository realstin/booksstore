// Middleware to verify JWT token from HTTP-only cookie and protect routes

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {

  // ========== GET TOKEN FROM COOKIE ==========

  const token = req.cookies.bookstowa_token;

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      message: 'No token provided. Please login first.'
    });
  }
  
  // ========== VERIFY TOKEN ==========
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ========== CHECK IF USER STILL EXISTS IN DATABASE ==========
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        message: 'User  does not exist. Please login again.'
      });
    }

    // Attach user information to the request
    
    req.user = decoded;

    next();

  } catch (error) {
    // Token expired
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired. Please login again.'
      });
    }
    // Token invalid
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token. Please login again.'
      });
    }
    // Other verification errors
    return res.status(401).json({
      message: 'Token verification failed. Please login again.'
    });
  }
};

module.exports = authenticate;