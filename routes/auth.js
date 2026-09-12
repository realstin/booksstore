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
const validateLoginInput = require("../middleware/validateLogin");
const authenticate      = require("../middleware/authenticate");

router.post("/register", validateUserInput, register);
router.post("/login",    validateLoginInput, login);
router.post("/google",   googleAuth);

router.get( "/me",     authenticate, getMe);
router.post("/logout", authenticate, logout);

module.exports = router;
