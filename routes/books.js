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

// ========== PROTECTED ROUTES ==========
// All these routes require a valid JWT token in header:
// Authorization: Bearer <token>

// CREATE a new book (requires authentication)
router.post('/', authenticate, validateBook, createBook);

// GET all books (requires authentication)
router.get('/', authenticate, getBooks);

// GET one book by ID (requires authentication)
router.get('/:id', authenticate, getBookById);

// UPDATE book by ID (requires authentication)
router.put('/:id', authenticate, validateBook, updateBook);

// DELETE book by ID (requires authentication)
router.delete('/:id', authenticate, deleteBook);

module.exports = router;