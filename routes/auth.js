const express = require("express");
const router  = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  googleAuth,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const validateUserInput = require("../middleware/validateUser");
const authenticate      = require("../middleware/authenticate");

// ========== PUBLIC ROUTES ==========

// Register new user — sends verification email, does NOT log in
router.post("/register", validateUserInput, register);

// Login — blocked for unverified accounts
router.post("/login", validateUserInput, login);

// Google OAuth
router.post("/google", googleAuth);

// Email verification — token arrives as ?token= query param
router.get("/verify-email", verifyEmail);

// Password reset flow
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);

// ========== PROTECTED ROUTES ==========

// Get current authenticated user
router.get("/me", authenticate, getMe);

// Logout
router.post("/logout", authenticate, logout);

module.exports = router;
