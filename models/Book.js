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

    pages: {
      type: Number
    },

    edition: {
      type: String,
      default: '1st Edition'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Book', bookSchema);
