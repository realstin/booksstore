// Middleware to verify JWT token and protect routes

const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // ========== GET TOKEN FROM HEADER ==========
  // Header looks like: "Authorization: Bearer <token>"
  // We need to extract just the token part
  
  const authHeader = req.headers.authorization;
  
  // Check if Authorization header exists
  if (!authHeader) {
    return res.status(401).json({
      message: 'No token provided. Please login first.'
    });
  }

  // ========== EXTRACT TOKEN FROM "Bearer <token>" ==========
  // authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  // We split by space and take the second part (index 1)
  
  const parts = authHeader.split(' ');
  
  // Check if format is correct: "Bearer <token>"
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      message: 'Invalid token format. Use: Authorization: Bearer <token>'
    });
  }

  const token = parts[1];

  // ========== VERIFY TOKEN ==========
  // jwt.verify does:
  // 1. Decode the token
  // 2. Check if signature is valid (using JWT_SECRET)
  // 3. Check if token is expired
  // 4. Return the decoded data (which has userId, email, etc.)
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If we reach here, token is REAL and NOT EXPIRED
    // decoded = { userId: "123", email: "user@email.com", iat: ..., exp: ... }
    
    // ========== ATTACH USER INFO TO REQUEST ==========
    // This way, the next route handler can access user info:
    // req.user = decoded;  means route can do: req.user.userId
    
    req.user = decoded;
    
    // ========== CONTINUE TO NEXT STEP ==========
    next();
    
  } catch (error) {
    // ========== TOKEN VERIFICATION FAILED ==========
    // Could be: expired, invalid signature, corrupted, etc.
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token. Please login again.'
      });
    }
    
    // Any other error
    return res.status(401).json({
      message: 'Token verification failed. Please login again.'
    });
  }
};

module.exports = authenticate;