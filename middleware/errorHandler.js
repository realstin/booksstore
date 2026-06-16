// Middleware: centralized error handler — must have 4 params for Express to treat it as error middleware
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
};

module.exports = errorHandler;
