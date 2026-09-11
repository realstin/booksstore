const mongoose = require('mongoose');

/**
 * The `active` flag is the unsubscribe mechanism. Setting it to
 * false removes the subscriber from all future sends without
 * deleting their record (preserves audit history).
 */

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    // How this subscriber was added
    source: {
      type:    String,
      enum:    ['user_registration', 'footer_form'],
      required: true,
    },

    // Reference to a User document  only set for registered users
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // false = unsubscribed; excluded from all future sends
    active: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt (subscription date) + updatedAt
  }
);

subscriberSchema.index({ active: 1 });

module.exports = mongoose.model('Subscriber', subscriberSchema);
