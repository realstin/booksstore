// Middleware to verify JWT token from HTTP-only cookie and protect routes

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {

  // ========== GET TOKEN FROM COOKIE ==========
  // Browser automatically sends:  Cookie: bookstowa_token=<token>
  // cookie-parser converts it into:   req.cookies.bookstowa_token
  const token = req.cookies.bookstowa_token;

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      message: 'No token provided. Please login first.'
    });
  }
  
  // ========== VERIFY TOKEN ==========
  // jwt.verify does:
  // 1. Check if the token signature is valid
  // 2. Check if the token has expired
  // 3. Return the data stored inside the token
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ========== CHECK IF USER STILL EXISTS IN DATABASE ==========
    // If user was deleted, they should not have access
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        message: 'User account has been deleted or does not exist. Please login again.'
      });
    }

    // Attach user information to the request
    // Other routes can access:  req.user.userId    req.user.email  req.user.name
    
    req.user = decoded;

    // Continue to the protected route
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