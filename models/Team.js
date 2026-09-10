const mongoose = require('mongoose');

/**
 * Team
 * -----------------------------------------------------------------
 * Replaces the hardcoded team member data in the frontend.
 * Supports social links and display order.
 */
const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    bio: {
      type: String,
      required: true,
    },

    photo: {
      type: String,
      default: '',
    },

    // Social links array
    socials: [
      {
        label: {
          type: String,
          required: true,
        },
        href: {
          type: String,
          required: true,
        },
        // Icon type: 'x', 'github', 'linkedin', 'globe', 'email'
        icon: {
          type: String,
          enum: ['x', 'github', 'linkedin', 'globe', 'email'],
          default: 'globe',
        },
      },
    ],

    // Display order (lower numbers appear first)
    order: {
      type: Number,
      default: 0,
    },

    // Active status
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('Team', teamSchema);
