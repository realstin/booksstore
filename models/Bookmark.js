const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    // The user who created this bookmark — always set from req.user.userId, never from request body
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The book being bookmarked
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },

    // The page number being bookmarked — must be a positive integer
    page: {
      type: Number,
      required: true,
      min: [1, 'Page number must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Page number must be an integer',
      },
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt — consistent with User and Book models
  }
);

// ── COMPOUND UNIQUE INDEX ────────────────────────────────────────────────────
// A user cannot bookmark the same page of the same book twice.
// This is enforced at the database level — not just in controller logic.
// MongoDB will throw an error with code 11000 if a duplicate is attempted,
// which the existing errorHandler already catches and converts to a 409.
// unique: true also creates the index automatically, so no separate index call needed.
bookmarkSchema.index({ user: 1, book: 1, page: 1 }, { unique: true });

// ── QUERY PERFORMANCE INDEXES ────────────────────────────────────────────────
// Fetch all bookmarks for a specific user sorted newest-first (GET /api/bookmarks)
bookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
