const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  googleAuth,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");
const validateUserInput = require("../middleware/validateUser");
const authenticate = require("../middleware/authenticate");

// ========== PUBLIC ROUTES ==========

// Register new user — sends verification email, does NOT log in
router.post("/register", validateUserInput, register);

// Login user
router.post("/login", validateUserInput, login);

// Google authentication
router.post("/google", googleAuth);

// Verify email address via token from the verification email
router.get("/verify-email", verifyEmail);

// Resend verification email
router.post("/resend-verification", resendVerification);

// ========== PROTECTED ROUTES ==========

// Get current user (requires valid token)
router.get("/me", authenticate, getMe);

// Logout user
router.post("/logout", authenticate, logout);

module.exports = router;
