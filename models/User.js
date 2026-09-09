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
      required: false,
      default: null,
    },

    googleId: {
      type: String,
      default: null,
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

    savedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],

    // ── Email verification ────────────────────────────────────────────────────
    emailVerified: {
      type:    Boolean,
      default: false,
    },

    // 6-digit numeric code sent by email (stored as string to preserve leading zeros)
    emailVerificationCode: {
      type:    String,
      default: null,
    },

    emailVerificationExpires: {
      type:    Date,
      default: null,
    },

    // ── Password reset ────────────────────────────────────────────────────────
    resetPasswordToken: {
      type:    String,
      default: null,
    },

    resetPasswordExpires: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
