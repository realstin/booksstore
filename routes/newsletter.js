const express       = require('express');
const router        = express.Router();
const authenticate  = require('../middleware/authenticate');
const requireAdmin  = require('../middleware/requireAdmin');

const {
  subscribe,
  unsubscribe,
  listSubscribers,
} = require('../controllers/newsletterController');

// ── Public routes (no auth required) ─────────────────────────────────────────

// POST /api/newsletter/subscribe
router.post('/subscribe', subscribe);

// POST /api/newsletter/unsubscribe
router.post('/unsubscribe', unsubscribe);

// ── Admin-only routes ─────────────────────────────────────────────────────────

// GET /api/newsletter/subscribers — list all subscribers
router.get('/subscribers', authenticate, requireAdmin, listSubscribers);

module.exports = router;
