const validateBook = (req, res, next) => {
  const {
    title,
    authors,
    language,
    isbn
  } = req.body;

  // Required fields
  if (!title || !authors || !language || !isbn) {
    return res.status(400).json({
      message: 'title, authors, language, and isbn are required.'
    });
  }

  // Title must be a string
  if (typeof title !== 'string') {
    return res.status(400).json({
      message: 'title must be a string.'
    });
  }

  // Authors must be an array
  if (!Array.isArray(authors) || authors.length === 0) {
    return res.status(400).json({
      message: 'authors must be a non-empty array.'
    });
  }

  // Language validation
  const allowedLanguages = ['en', 'fr', 'rw'];

  if (!allowedLanguages.includes(language)) {
    return res.status(400).json({
      message: `language must be one of: ${allowedLanguages.join(', ')}`
    });
  }

  // ISBN must be a string
  if (typeof isbn !== 'string') {
    return res.status(400).json({
      message: 'isbn must be a string.'
    });
  }

  next();
};

module.exports = validateBook;