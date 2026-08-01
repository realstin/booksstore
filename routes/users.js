const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const {
  saveBook,
  removeBook,
  getLibrary,
} = require('../controllers/libraryController');

// All library routes require authentication
router.use(authenticate);

// GET  /api/users/library          — get the authenticated user's saved books
router.get('/library', getLibrary);

// POST /api/users/library/save/:bookId   — save a book to the library
router.post('/library/save/:bookId', saveBook);

// DELETE /api/users/library/remove/:bookId — remove a book from the library
router.delete('/library/remove/:bookId', removeBook);

module.exports = router;
