const mongoose = require('mongoose');

/**
 * Subscriber
 * -----------------------------------------------------------------
 * Stores every email that should receive BookStore notifications.
 *
 * There are two ways someone ends up here:
 *   1. 'user_registration' — created automatically when a user
 *      registers (email/password or Google). The userId field links
 *      back to their User document.
 *   2. 'footer_form' — a visitor (no account) entered their email
 *      in the footer newsletter form. userId is null.
 *
 * The `active` flag is the unsubscribe mechanism. Setting it to
 * false removes the subscriber from all future sends without
 * deleting their record (preserves audit history).
 *
 * Email delivery is NOT implemented here — this model is the
 * foundation (the "who to notify" list). The actual sending
 * will be wired up when an email provider is chosen.
 * -----------------------------------------------------------------
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

    // Reference to a User document — only set for registered users
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

// The unique:true on the email field already creates an index automatically.
// No need for an explicit additional index — removing the duplicate.
// Index for fast lookup by active status when sending bulk emails.
subscriberSchema.index({ active: 1 });

module.exports = mongoose.model('Subscriber', subscriberSchema);
