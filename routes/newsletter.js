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

// POST /api/newsletter/test-email
// Sends a plain test email to verify Gmail SMTP is working on Render.
// Body: { to: "your@email.com" }
// Protected — requires a valid session cookie.
// DELETE THIS ROUTE after confirming emails work.
router.post('/test-email', authenticate, async (req, res, next) => {
  try {
    const to = (req.body.to || '').trim();
    if (!to) {
      return res.status(400).json({ message: 'Provide a "to" email address in the request body.' });
    }

    await sendMail({
      to,
      subject: 'BookStore — SMTP test email',
      html:    '<p style="font-family:sans-serif;">If you received this, Gmail SMTP is working correctly on the server.</p>',
      text:    'If you received this, Gmail SMTP is working correctly on the server.',
    });

    return res.status(200).json({ message: `Test email sent successfully to ${to}` });
  } catch (err) {
    // Return the full error so we can see exactly what is wrong
    return res.status(500).json({
      message: 'Test email failed.',
      error:   err.message,
      code:    err.code || null,
    });
  }
});

module.exports = router;
