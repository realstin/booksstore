const express = require("express");
const router = express.Router();

const { register, login, logout, getMe, googleAuth } = require("../controllers/authController");
const validateUserInput = require("../middleware/validateUser");
const authenticate = require("../middleware/authenticate");

// ========== PUBLIC ROUTES ==========

// Register new user
router.post("/register", validateUserInput, register);

// Login user
router.post("/login", validateUserInput, login);

// Google authentication — frontend sends the Google ID token, backend verifies and issues cookie
router.post("/google", googleAuth);

// ========== PROTECTED ROUTES ==========

// Get current user (requires valid token)
router.get("/me", authenticate, getMe);

// Logout user
router.post("/logout", authenticate, logout);

module.exports = router;