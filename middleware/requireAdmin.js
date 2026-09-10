// Middleware to restrict a route to admin users only.
// Must be used AFTER authenticate — it relies on req.user being the real
// DB document that authenticate attaches (with the correct role field).
//
// Usage:
//   router.post('/', authenticate, requireAdmin, handler);

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      code:    'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  }
  next();
};

module.exports = requireAdmin;
