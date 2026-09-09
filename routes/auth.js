const express = require("express");
const router  = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  googleAuth,
} = require("../controllers/authController");

const validateUserInput = require("../middleware/validateUser");
const authenticate      = require("../middleware/authenticate");

router.post("/register", validateUserInput, register);
router.post("/login",    validateUserInput, login);
router.post("/google",   googleAuth);

router.get( "/me",     authenticate, getMe);
router.post("/logout", authenticate, logout);

module.exports = router;
