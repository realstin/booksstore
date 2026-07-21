const express = require('express');
const router = express.Router();

const validateBook = require('../middleware/validateBook');
const authenticate = require('../middleware/authenticate');

const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook
} = require('../controllers/bookController');

// Public routes — anyone (including logged-out visitors on the homepage) can browse books

// GET all books
router.get('/', getBooks);

// GET one book by ID
router.get('/:id', getBookById);

// Protected routes — require authentication

// CREATE a new book
router.post('/', authenticate, validateBook, createBook);

// UPDATE book by ID
router.put('/:id', authenticate, validateBook, updateBook);

// DELETE book by ID
router.delete('/:id', authenticate, deleteBook);

module.exports = router;