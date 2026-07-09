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
      required: true,
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

    // ========== EMAIL VERIFICATION FIELDS ==========
    emailVerified: {
      type: Boolean,
      default: false,  // User starts as unverified
    },

    verificationCode: {
      type: String,
      default: null,  // Will store the 6-digit code
    },

    verificationCodeExpires: {
      type: Date,
      default: null,  // Will store when code expires (10 minutes from now)
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);