const express = require("express");
const router = express.Router();

const { register, login, logout } = require("../controllers/authController");
const validateUserInput = require("../middleware/validateUser");
const authenticate = require("../middleware/authenticate");

// ========== REGISTER ENDPOINT ==========
router.post("/register", validateUserInput, register);

// ========== LOGIN ENDPOINT ==========
router.post("/login", validateUserInput, login);

// ========== LOGOUT ENDPOINT ==========
// Protected route - user must be authenticated (have valid token in cookie)
router.post("/logout", authenticate, logout);

module.exports = router;