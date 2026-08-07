const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const {
  createNote,
  getNotesForBook,
  getAllNotes,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');

// All note endpoints require authentication — applied once to the whole router
router.use(authenticate);

// GET /api/notes/book/:bookId — all notes for the authenticated user on a specific book
// Registered BEFORE GET / so Express does not try to match "book" as a noteId param
router.get('/book/:bookId', getNotesForBook);

// GET    /api/notes            — all notes for the authenticated user (book populated)
router.get('/', getAllNotes);

// POST   /api/notes            — create a note { bookId, page, content }
router.post('/', createNote);

// PATCH  /api/notes/:noteId    — update note content { content }
router.patch('/:noteId', updateNote);

// DELETE /api/notes/:noteId    — delete a note
router.delete('/:noteId', deleteNote);

module.exports = router;
