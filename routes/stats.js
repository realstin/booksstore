const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/statsController');

// GET /api/stats — public, no authentication required
// Returns live-calculated platform statistics for the homepage.
router.get('/', getStats);

module.exports = router;
