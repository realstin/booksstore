const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    // There should only be ONE document with _id: 'main'
    _id: {
      type: String,
      default: 'main',
    },

    totalUsers: {
      type: Number,
      default: 0,
      description: 'Total number of registered users',
    },

    totalBooks: {
      type: Number,
      default: 0,
      description: 'Total number of books in library',
    },

    totalSavedBooks: {
      type: Number,
      default: 0,
      description: 'Total number of times books were saved by users',
    },

    averageRating: {
      type: Number,
      default: 0,
      description: 'Average rating of all books',
    },

    // Updated timestamp so you know when stats were last updated
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Stats', statsSchema);