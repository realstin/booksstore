const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const { sendMail } = require('../utils/mailer');

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

// ── Protected routes (admin only) ────────────────────────────────────────────

// GET /api/newsletter/subscribers
router.get('/subscribers', authenticate, listSubscribers);


module.exports = router;
