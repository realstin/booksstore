const express = require("express");
const router = express.Router();

const { getStats, updateStats } = require("../controllers/statsController");
const authenticate = require("../middleware/authenticate");

// ========== PUBLIC ROUTES ==========

// GET stats (public - show on homepage)
router.get("/", getStats);

// ========== PROTECTED ROUTES ==========

// PUT stats (admin only - update manually)
router.put("/", authenticate, updateStats);

module.exports = router;