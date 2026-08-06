const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const {
  createBookmark,
  deleteBookmark,
  getBookmarksForBook,
  getAllBookmarks,
} = require('../controllers/bookmarkController');

// All bookmark endpoints require authentication — applied once to the whole router
router.use(authenticate);

// GET /api/bookmarks/book/:bookId — bookmarks for a specific book
// Must be registered BEFORE GET /api/bookmarks to avoid Express matching
// "book" as the :bookId param of a different route.
router.get('/book/:bookId', getBookmarksForBook);

// GET    /api/bookmarks          — all bookmarks for the authenticated user
router.get('/', getAllBookmarks);

// POST   /api/bookmarks          — create a bookmark
router.post('/', createBookmark);

// DELETE /api/bookmarks/:bookId/:page — delete a specific bookmark
router.delete('/:bookId/:page', deleteBookmark);

module.exports = router;
