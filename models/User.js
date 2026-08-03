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