const Subscriber = require('../models/Subscriber');

/**
 * newsletterController
 * -----------------------------------------------------------------
 * Handles the three public-facing newsletter operations:
 *
 *   subscribe   — POST /api/newsletter/subscribe
 *   unsubscribe — POST /api/newsletter/unsubscribe
 *   list        — GET  /api/newsletter/subscribers  (admin only)
 *
 * Email delivery is intentionally NOT implemented here.
 * This controller only manages the subscriber list — who should
 * receive notifications. Actual sending will be added later once
 * an email provider is chosen.
 * -----------------------------------------------------------------
 */

/* ─────────────────────────────────────────────────────────────────
   SUBSCRIBE
   POST /api/newsletter/subscribe
   Public — no authentication required.
   Body: { email: string }

   Logic:
   - If email already exists and is active → return "already subscribed"
   - If email exists but was unsubscribed → reactivate it
   - If email is new → create a new footer_form subscriber
───────────────────────────────────────────────────────────────── */
exports.subscribe = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const existing = await Subscriber.findOne({ email });

    if (existing) {
      if (existing.active) {
        // Already subscribed — treat as success so the UI stays clean
        return res.status(200).json({
          message: 'You are already subscribed.',
          alreadySubscribed: true,
        });
      }

      // Was previously unsubscribed — reactivate
      existing.active = true;
      await existing.save();

      console.log(`[NEWSLETTER] Reactivated subscriber: ${email}`);
      return res.status(200).json({
        message: 'You have been resubscribed successfully.',
        resubscribed: true,
      });
    }

    // Brand new subscriber from the footer form
    await Subscriber.create({
      email,
      source: 'footer_form',
      userId: null,
      active: true,
    });

    console.log(`[NEWSLETTER] New footer subscriber: ${email}`);
    return res.status(201).json({
      message: 'You have subscribed successfully. Thank you!',
    });

  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────────
   UNSUBSCRIBE
   POST /api/newsletter/unsubscribe
   Public — no authentication required (one-click unsubscribe
   from email links must work without a session).
   Body: { email: string }

   Sets active: false. The record is kept for audit history.
───────────────────────────────────────────────────────────────── */
exports.unsubscribe = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const subscriber = await Subscriber.findOne({ email });

    // If not found or already inactive — still return success.
    // No need to reveal whether the email exists in the database.
    if (!subscriber || !subscriber.active) {
      return res.status(200).json({
        message: 'You have been unsubscribed.',
      });
    }

    subscriber.active = false;
    await subscriber.save();

    console.log(`[NEWSLETTER] Unsubscribed: ${email}`);
    return res.status(200).json({
      message: 'You have been unsubscribed successfully.',
    });

  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────────
   LIST SUBSCRIBERS
   GET /api/newsletter/subscribers
   Admin only — protected by authenticate middleware in the route.

   Query params (all optional):
     active=true|false  — filter by active status
     source=user_registration|footer_form
     limit=50           — default 100, max 500
     page=1             — for pagination

   Returns total count + paginated subscriber list.
───────────────────────────────────────────────────────────────── */
exports.listSubscribers = async (req, res, next) => {
  try {
    const filter = {};

    // Filter by active status
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    // Filter by source
    if (req.query.source) {
      const validSources = ['user_registration', 'footer_form'];
      if (validSources.includes(req.query.source)) {
        filter.source = req.query.source;
      }
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const page  = Math.max(parseInt(req.query.page,  10) || 1,   1);
    const skip  = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      Subscriber.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Subscriber.countDocuments(filter),
    ]);

    return res.status(200).json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      subscribers,
    });

  } catch (err) {
    next(err);
  }
};
