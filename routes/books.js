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

// protected routes that all requires authentication

// CREATE a new book 
router.post('/', authenticate, validateBook, createBook);

// GET all books 
router.get('/', authenticate, getBooks);

// GET one book by ID 
router.get('/:id', authenticate, getBookById);

// UPDATE book by ID 
router.put('/:id', authenticate, validateBook, updateBook);

// DELETE book by ID 
router.delete('/:id', authenticate, deleteBook);

module.exports = router;