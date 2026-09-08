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

// ── Public ────────────────────────────────────────────────────────────────────

router.post("/register",       validateUserInput, register);
router.post("/login",          validateUserInput, login);
router.post("/google",         googleAuth);
router.get( "/verify-email",   verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);

// ── Protected ─────────────────────────────────────────────────────────────────

router.get( "/me",     authenticate, getMe);
router.post("/logout", authenticate, logout);

module.exports = router;
