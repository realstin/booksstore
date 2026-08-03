const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      // Not required — Google-authenticated users have no password
      required: false,
      default: null,
    },

    // Google OAuth identity — populated when a user signs in via Google
    // null for users who only use email/password
    googleId: {
      type: String,
      default: null,
      // sparse so that null values don't conflict with each other in the unique index
      unique: true,
      sparse: true,
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },

    avatar: {
      type: String,
      default: "",
    },

    // ── EMAIL VERIFICATION ───────────────────────────────────────────────────
    // Default is TRUE so that existing accounts in the database are never
    // accidentally locked out when this field is first added.
    // The register function explicitly sets this to FALSE for new email/password
    // sign-ups so they must verify before they can log in.
    // Google-authenticated users are created with TRUE because Google has already
    // verified ownership of the email address.
    emailVerified: {
      type: Boolean,
      default: true,
    },

    // SHA-256 hash of the one-time verification token — never the raw token.
    // Null once the email is verified or before a token is generated.
    emailVerificationTokenHash: {
      type: String,
      default: null,
    },

    // When the current verification token expires (24 hours from generation).
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },

    // Books saved by this user — stores ObjectId references only, not full documents
    savedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);