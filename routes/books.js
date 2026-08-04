const express = require('express');
const router = express.Router();

const validateBook = require('../middleware/validateBook');
const authenticate = require('../middleware/authenticate');
const { getStats, updateStats } = require('../controllers/statsController');

const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  downloadBook
} = require('../controllers/bookController');

// ===== PUBLIC ROUTES =====

// GET all books
router.get('/', getBooks);

// GET statistics
router.get('/stats', getStats);

// DOWNLOAD book PDF
router.get('/:id/download',authenticate, downloadBook);

// GET one book by ID
router.get('/:id', getBookById);

// ===== PROTECTED ROUTES =====

// CREATE a new book
router.post('/', authenticate, validateBook, createBook);

// UPDATE book by ID
router.put('/:id', authenticate, validateBook, updateBook);

// DELETE book by ID
router.delete('/:id', authenticate, deleteBook);
// ── STATS ENDPOINTS ──────────────────────────────────────────────────────
// GET stats (public - show on homepage)
router.get('/stats', getStats);

// PUT stats (admin only - update manually)
router.put('/stats', authenticate, updateStats);

module.exports = router;