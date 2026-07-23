const express = require('express');
const router = express.Router();

const validateBook = require('../middleware/validateBook');
const authenticate = require('../middleware/authenticate');
const { getStats } = require('../controllers/statsController');

const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook
} = require('../controllers/bookController');

// ===== PUBLIC ROUTES =====

// GET all books
router.get('/', getBooks);

// ⭐ STATS ROUTE - PUT THIS FIRST (before /:id)
router.get('/stats', getStats);

// GET one book by ID - PUT THIS AFTER /stats
router.get('/:id', getBookById);

// ===== PROTECTED ROUTES =====

router.post('/', authenticate, validateBook, createBook);
router.put('/:id', authenticate, validateBook, updateBook);
router.delete('/:id', authenticate, deleteBook);

module.exports = router;