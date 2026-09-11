const mongoose = require('mongoose');

/**
 * Article
 * -----------------------------------------------------------------
 * Replaces the hardcoded news.js article array in the frontend.
 * Supports structured content blocks (paragraph, heading, image, quote, divider).
 */
const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    subtitle: {
      type: String,
      default: '',
    },

    excerpt: {
      type: String,
      required: true,
    },

    // Display date (not necessarily createdAt)
    date: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      default: '',
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    coverImage: {
      type: String,
      default: null,
    },

    readTime: {
      type: String,
      default: '',
    },

    author: {
      name: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        default: '',
      },
      initials: {
        type: String,
        default: '',
      },
    },

    featured: {
      type: Boolean,
      default: false,
    },

    // Article published status
    published: {
      type: Boolean,
      default: false,
    },

    // Optional event object
    event: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Content blocks array
    content: [
      {
        type: {
          type: String,
          enum: ['paragraph', 'heading', 'image', 'quote', 'divider'],
          required: true,
        },
        content: {
          type: String,
          default: '',
        },
        // Optional: for images
        alt: String,
        caption: String,
      },
    ],

    // Track when article was published (different from createdAt)
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes — slug uniqueness is already enforced by unique:true above
articleSchema.index({ published: 1 });
articleSchema.index({ featured: 1 });
articleSchema.index({ category: 1 });
articleSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
