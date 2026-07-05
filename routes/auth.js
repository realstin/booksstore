const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const validateUserInput = require("../middleware/validateUser");

// ========== REGISTER ENDPOINT ==========
// POST /api/auth/register
// User sends: { name, email, password }
// What happens:
//   1. validateUserInput middleware checks the input
//   2. If valid, calls register function
//   3. register creates user in database
//   4. Returns confirmation message

router.post("/register", validateUserInput, register);

// ========== LOGIN ENDPOINT ==========
// POST /api/auth/login
// User sends: { email, password }
// What happens:
//   1. validateUserInput middleware checks the input
//   2. If valid, calls login function
//   3. login checks email & password
//   4. If correct, creates JWT token
//   5. Returns token to user

router.post("/login", validateUserInput, login);

module.exports = router;