// Middleware: centralized error handler — must have 4 params for Express to treat it as error middleware
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);

  // Mongoose validation error (e.g. required field missing, enum mismatch)
  // Thrown when a document fails schema rules at the database layer.
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }

  // Mongoose duplicate key error (e.g. isbn or email already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      message: `${field} '${err.keyValue[field]}' already exists.`
    });
  }

  // Mongoose bad ObjectId in a URL param (e.g. GET /api/books/not-a-valid-id)
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: `Invalid ${err.path}: ${err.value}`
    });
  }

  // Fallback: anything we didn't recognize is treated as a real server error
  res.status(500).json({
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;