const express       = require('express');
const router        = express.Router();

const validateBook  = require('../middleware/validateBook');
const authenticate  = require('../middleware/authenticate');
const requireAdmin  = require('../middleware/requireAdmin');

const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  downloadBook,
  servePdf
} = require('../controllers/bookController');

// ===== PUBLIC ROUTES =====

// GET all books
router.get('/', getBooks);

// GET one book by ID
router.get('/:id', getBookById);

// ===== AUTHENTICATED USER ROUTES =====

// DOWNLOAD book PDF (triggers browser save-to-disk)
router.get('/:id/download', authenticate, downloadBook);

// SERVE book PDF inline for PDF.js reader (must stay above /:id)
router.get('/:id/pdf', authenticate, servePdf);

// ===== ADMIN-ONLY ROUTES =====

// CREATE a new book
router.post('/', authenticate, requireAdmin, validateBook, createBook);

// UPDATE book by ID
router.put('/:id', authenticate, requireAdmin, validateBook, updateBook);

// DELETE book by ID
router.delete('/:id', authenticate, requireAdmin, deleteBook);

module.exports = router;