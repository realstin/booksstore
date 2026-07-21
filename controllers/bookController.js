const Book = require('../models/Book');

const createBook = async (req, res, next) => {
  try {
    const book = new Book(req.body);
    const savedBook = await book.save();
    res.status(201).json(savedBook);
  } catch (err) {
    next(err);
  }
};

const getBooks = async (req, res, next) => {
  try {
    const { featured, limit, sort } = req.query;

    const filter = {};
    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    // Default: newest books first. Allow override via ?sort=-rating, ?sort=-savesCount, etc.
    const sortOption = sort || '-createdAt';

    // Cap the limit so a stray value like ?limit=999999 can't be used to dump the whole collection
    const parsedLimit = Math.min(parseInt(limit, 10) || 0, 100) || 0;

    let query = Book.find(filter).sort(sortOption);
    if (parsedLimit > 0) {
      query = query.limit(parsedLimit);
    }

    const books = await query;
    res.status(200).json(books);
  } catch (err) {
    next(err);
  }
};

const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook
};