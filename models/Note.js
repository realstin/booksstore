const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    // The user who wrote this note — always set from req.user.userId, never from the request body
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The book this note belongs to
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },

    // The page the note is attached to — must be a positive integer
    page: {
      type: Number,
      required: true,
      min: [1, 'Page number must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Page number must be an integer',
      },
    },

    // The note content written by the user
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
      minlength: [1, 'Note content cannot be empty'],
      // 5 000 characters: enough for a detailed annotation, prevents accidental
      // storage of very large payloads.
      maxlength: [5000, 'Note content cannot exceed 5 000 characters'],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt — consistent with User, Book, Bookmark
  }
);

// ── INDEXES ──────────────────────────────────────────────────────────────────

// Primary query: all notes for a specific user within a specific book (sorted by page)
// Used by GET /api/notes/book/:bookId
noteSchema.index({ user: 1, book: 1, page: 1 });

// Primary query: all notes for a user, sorted newest-first
// Used by GET /api/notes
noteSchema.index({ user: 1, createdAt: -1 });

// ── NOTE ON UNIQUENESS ────────────────────────────────────────────────────────
// { user, book, page } is intentionally NOT unique.
// A user may write multiple notes on the same page (e.g. notes on different
// concepts or quotes encountered on that page). Each note is individually
// addressable by its _id for update and delete operations.

module.exports = mongoose.model('Note', noteSchema);
