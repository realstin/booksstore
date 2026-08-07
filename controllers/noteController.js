const mongoose = require('mongoose');
const Note = require('../models/Note');
const Book = require('../models/Book');

const MAX_CONTENT_LENGTH = 5000;

// ── HELPER ────────────────────────────────────────────────────────────────────
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── CREATE NOTE ───────────────────────────────────────────────────────────────
// POST /api/notes
// Body: { bookId, page, content }
exports.createNote = async (req, res, next) => {
  try {
    const { bookId, page, content } = req.body;
    const userId = req.user.userId; // always from JWT — never from the request body

    // ── Validate bookId ──────────────────────────────────────────────────────
    if (!bookId) {
      return res.status(400).json({ message: 'bookId is required.' });
    }
    if (!isValidObjectId(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // ── Validate page ────────────────────────────────────────────────────────
    if (page === undefined || page === null) {
      return res.status(400).json({ message: 'page is required.' });
    }
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({
        message: 'page must be a positive integer (1 or greater).',
      });
    }

    // ── Validate content ─────────────────────────────────────────────────────
    if (content === undefined || content === null) {
      return res.status(400).json({ message: 'content is required.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ message: 'content must be a string.' });
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return res.status(400).json({ message: 'Note content cannot be empty.' });
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        message: `Note content cannot exceed ${MAX_CONTENT_LENGTH} characters.`,
      });
    }

    // ── Verify the book exists ───────────────────────────────────────────────
    const bookExists = await Book.exists({ _id: bookId });
    if (!bookExists) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // ── Create the note ──────────────────────────────────────────────────────
    const note = await Note.create({
      user: userId,
      book: bookId,
      page: pageNum,
      content: trimmedContent,
    });

    return res.status(201).json({
      message: 'Note created successfully.',
      note,
    });

  } catch (err) {
    next(err);
  }
};

// ── GET NOTES FOR A BOOK ──────────────────────────────────────────────────────
// GET /api/notes/book/:bookId
// Returns all notes for the authenticated user on the specified book.
// Sorted by page ascending, then by createdAt ascending (natural reading order).
exports.getNotesForBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.userId;

    // ── Validate bookId ──────────────────────────────────────────────────────
    if (!isValidObjectId(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // ── Verify the book exists ───────────────────────────────────────────────
    const bookExists = await Book.exists({ _id: bookId });
    if (!bookExists) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // ── Fetch — scoped to this user and this book ────────────────────────────
    const notes = await Note.find({ user: userId, book: bookId })
      .select('_id book page content createdAt updatedAt')
      .sort({ page: 1, createdAt: 1 });

    return res.status(200).json({ notes });

  } catch (err) {
    next(err);
  }
};

// ── GET ALL USER NOTES ────────────────────────────────────────────────────────
// GET /api/notes
// Returns all notes belonging to the authenticated user.
// Book is populated with enough data for a notes list/library view.
// Sorted newest first.
exports.getAllNotes = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const notes = await Note.find({ user: userId })
      .populate({
        path: 'book',
        select: '_id title authors coverImage pages',
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ notes });

  } catch (err) {
    next(err);
  }
};

// ── UPDATE NOTE ───────────────────────────────────────────────────────────────
// PATCH /api/notes/:noteId
// Body: { content }
// Only the owner of the note can update it — query always includes user: userId.
exports.updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // ── Validate noteId ──────────────────────────────────────────────────────
    if (!isValidObjectId(noteId)) {
      return res.status(400).json({ message: `Invalid noteId: ${noteId}` });
    }

    // ── Validate content ─────────────────────────────────────────────────────
    if (content === undefined || content === null) {
      return res.status(400).json({ message: 'content is required.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ message: 'content must be a string.' });
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return res.status(400).json({ message: 'Note content cannot be empty.' });
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        message: `Note content cannot exceed ${MAX_CONTENT_LENGTH} characters.`,
      });
    }

    // ── Update — scoped to this user so cross-user modification is impossible ─
    const note = await Note.findOneAndUpdate(
      { _id: noteId, user: userId }, // user scoping is the security guarantee
      { content: trimmedContent },
      { new: true, runValidators: true }
    );

    if (!note) {
      // Either the note doesn't exist or belongs to a different user.
      // Return 404 in both cases — don't reveal whether the note exists at all.
      return res.status(404).json({ message: 'Note not found.' });
    }

    return res.status(200).json({
      message: 'Note updated successfully.',
      note,
    });

  } catch (err) {
    next(err);
  }
};

// ── DELETE NOTE ───────────────────────────────────────────────────────────────
// DELETE /api/notes/:noteId
// Only the owner of the note can delete it — query always includes user: userId.
exports.deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.userId;

    // ── Validate noteId ──────────────────────────────────────────────────────
    if (!isValidObjectId(noteId)) {
      return res.status(400).json({ message: `Invalid noteId: ${noteId}` });
    }

    // ── Delete — scoped to this user ─────────────────────────────────────────
    const result = await Note.findOneAndDelete({ _id: noteId, user: userId });

    if (!result) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    return res.status(200).json({ message: 'Note deleted successfully.' });

  } catch (err) {
    next(err);
  }
};
