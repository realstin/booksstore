const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');
const Book = require('../models/Book');

// ── HELPER ────────────────────────────────────────────────────────────────────
// Validate that a string is a well-formed MongoDB ObjectId before querying.
// Returns a 400 response and stops execution if invalid.
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── CREATE BOOKMARK ───────────────────────────────────────────────────────────
// POST /api/bookmarks
// Body: { bookId, page }
// Creates a bookmark for the authenticated user on the given book and page.
// Returns the existing bookmark cleanly if it already exists — no error, no duplicate.
exports.createBookmark = async (req, res, next) => {
  try {
    const { bookId, page } = req.body;
    const userId = req.user.userId; // always from JWT — never from request body

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

    // ── Verify the book exists ───────────────────────────────────────────────
    const book = await Book.findById(bookId).select('_id title');
    if (!book) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // ── Check for existing bookmark ──────────────────────────────────────────
    // Check before attempting to insert so we can return a friendly response
    // rather than relying solely on the 11000 duplicate key error.
    const existing = await Bookmark.findOne({
      user: userId,
      book: bookId,
      page: pageNum,
    });

    if (existing) {
      return res.status(200).json({
        message: 'Page is already bookmarked.',
        alreadyExists: true,
        bookmark: existing,
      });
    }

    // ── Create the bookmark ──────────────────────────────────────────────────
    const bookmark = await Bookmark.create({
      user: userId,
      book: bookId,
      page: pageNum,
    });

    return res.status(201).json({
      message: 'Bookmark created.',
      alreadyExists: false,
      bookmark,
    });

  } catch (err) {
    // The compound unique index acts as a final safety net.
    // If two concurrent requests slip through the findOne check simultaneously,
    // MongoDB throws code 11000 which the existing errorHandler converts to 409.
    next(err);
  }
};

// ── DELETE BOOKMARK ───────────────────────────────────────────────────────────
// DELETE /api/bookmarks/:bookId/:page
// Deletes the bookmark belonging to the authenticated user for the given book+page.
// Users can only delete their own bookmarks — userId comes from JWT, not the URL.
exports.deleteBookmark = async (req, res, next) => {
  try {
    const { bookId, page } = req.params;
    const userId = req.user.userId;

    // ── Validate bookId ──────────────────────────────────────────────────────
    if (!isValidObjectId(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // ── Validate page ────────────────────────────────────────────────────────
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({
        message: 'page must be a positive integer (1 or greater).',
      });
    }

    // ── Verify the book exists ───────────────────────────────────────────────
    const bookExists = await Book.exists({ _id: bookId });
    if (!bookExists) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // ── Delete — scoped to this user so cross-user deletion is impossible ────
    const result = await Bookmark.findOneAndDelete({
      user: userId,
      book: bookId,
      page: pageNum,
    });

    if (!result) {
      return res.status(200).json({
        message: 'Bookmark not found — nothing to delete.',
        deleted: false,
      });
    }

    return res.status(200).json({
      message: 'Bookmark deleted.',
      deleted: true,
    });

  } catch (err) {
    next(err);
  }
};

// ── GET BOOKMARKS FOR A BOOK ──────────────────────────────────────────────────
// GET /api/bookmarks/book/:bookId
// Returns all bookmarks belonging to the authenticated user for the specified book,
// sorted by page number ascending (useful for the Reader to list bookmarks in order).
exports.getBookmarksForBook = async (req, res, next) => {
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

    // ── Fetch bookmarks — user-scoped, sorted by page ascending ─────────────
    const bookmarks = await Bookmark.find({ user: userId, book: bookId })
      .select('_id book page createdAt updatedAt')
      .sort({ page: 1 });

    return res.status(200).json({
      bookmarks,
      count: bookmarks.length,
    });

  } catch (err) {
    next(err);
  }
};

// ── GET ALL USER BOOKMARKS ────────────────────────────────────────────────────
// GET /api/bookmarks
// Returns all bookmarks belonging to the authenticated user, with the book
// reference populated so the frontend can display title, cover, and authors
// without a second request. Sorted newest first.
exports.getAllBookmarks = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const bookmarks = await Bookmark.find({ user: userId })
      .populate({
        path: 'book',
        select: '_id title authors coverImage categories rating savesCount pages',
      })
      .sort({ createdAt: -1 }); // newest first — consistent with library pattern

    return res.status(200).json({
      bookmarks,
      count: bookmarks.length,
    });

  } catch (err) {
    next(err);
  }
};
