const express    = require('express');
const router     = express.Router();
const authenticate = require('../middleware/authenticate');

const {
  subscribe,
  unsubscribe,
  listSubscribers,
} = require('../controllers/newsletterController');

// ── Public routes (no auth required) ─────────────────────────────────────────

// POST /api/newsletter/subscribe
// Footer form + any visitor can subscribe
router.post('/subscribe', subscribe);

// POST /api/newsletter/unsubscribe
// One-click unsubscribe — must work without a session cookie
router.post('/unsubscribe', unsubscribe);

// ── Protected routes (admin only) ────────────────────────────────────────────

// GET /api/newsletter/subscribers
// Returns paginated list of all subscribers — requires a valid session
router.get('/subscribers', authenticate, listSubscribers);

module.exports = router;
