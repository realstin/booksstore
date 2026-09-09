const express = require("express");
const router  = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  googleAuth,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const validateUserInput = require("../middleware/validateUser");
const authenticate      = require("../middleware/authenticate");

router.post("/register", validateUserInput, register);
router.post("/login",    validateUserInput, login);
router.post("/google",   googleAuth);

router.get( "/me",     authenticate, getMe);
router.post("/logout", authenticate, logout);

// Email verification
router.get( "/verify-email",       verifyEmail);
router.post("/resend-verification", resendVerification);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);

module.exports = router;
