const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const validateUserInput = require("../middleware/validateUser");

// ========== REGISTER ENDPOINT ==========
router.post("/register", validateUserInput, register);

// ========== LOGIN ENDPOINT ==========
router.post("/login", validateUserInput, login);

module.exports = router;