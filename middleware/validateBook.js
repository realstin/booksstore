// Middleware: validate that title, author, and price are present in req.body
const validateBook = (req, res, next) => {
  const { title, author, price } = req.body;

  if (!title || !author || price === undefined) {
    return res.status(400).json({
      message: 'title, author, and price are all required',
    });
  }

  next();
};

module.exports = validateBook;
