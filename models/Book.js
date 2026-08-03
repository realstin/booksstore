const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    authors: {
      type: [String],
      required: true
    },

    description: {
      type: String,
      default: ''
    },

    categories: {
      type: [String],
      default: []
    },

    language: {
      type: String,
      required: true,
      enum: ['en', 'fr', 'rw']
    },

    isbn: {
      type: String,
      unique: true,
      required: true
    },

    publisher: {
      type: String,
      default: ''
    },

    publishedDate: {
      type: Date
    },

    coverImage: {
      type: String,
      default: ''
    },

    // URL where the actual book file (PDF) can be downloaded/read from
    pdfUrl: {
      type: String,
      default: ''
    },

    pages: {
      type: Number
    },

    edition: {
      type: String,
      default: '1st Edition'
    },

    // Average reader rating out of 5 (e.g. shown on Community Favorites cards)
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    // How many readers have saved/bookmarked this book
    savesCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Manually flag a book to appear in "Community Favorites" / "Trending"
    featured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);
// ============ NEW: DATABASE INDEXES ============

// Index for filtering by featured status
bookSchema.index({ featured: 1 });

// Compound index for featured books sorted by date (very common query)
bookSchema.index({ featured: 1, createdAt: -1 });

// Index for sorting by creation date
bookSchema.index({ createdAt: -1 });

// Index for sorting by rating
bookSchema.index({ rating: -1 });

// Index for sorting by saves count
bookSchema.index({ savesCount: -1 });

// Index for searching by ISBN (already unique, but good for queries)
bookSchema.index({ isbn: 1 });

// ============ END INDEXES ============

module.exports = mongoose.model('Book', bookSchema);