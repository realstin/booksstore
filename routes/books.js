const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const validateBook = require('../middleware/validateBook');

// POST /api/books — Create a new book
router.post('/', validateBook, async (req, res, next) => {
  try {
    const book = new Book(req.body);
    const savedBook = await book.save();
    res.status(201).json(savedBook);
  } catch (err) {
    next(err);
  }
});

// GET /api/books — Return all books
router.get('/', async (req, res, next) => {
  try {
    const allBooks = await Book.find();
    res.status(200).json(allBooks);
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id — Return a single book by ID
router.get('/:id', async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

// PUT /api/books/:id — Update a book by ID
router.put('/:id', validateBook, async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/books/:id — Delete a book by ID
router.delete('/:id', async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
