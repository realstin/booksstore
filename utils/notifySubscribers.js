const Subscriber       = require('../models/Subscriber');
const { sendMail }     = require('./mailer');
const { newBookEmail, newArticleEmail } = require('./emailTemplates');

/**
 * notifySubscribers.js
 * -----------------------------------------------------------------
 * Fire-and-forget helpers for sending bulk notifications.
 *
 * IMPORTANT — these functions are intentionally NOT awaited by the
 * callers (bookController, etc.). The API response is sent to the
 * admin immediately. Emails go out in the background.
 *
 * Failures are logged but never re-thrown. A broken email config
 * must never prevent a book from being created or updated.
 *
 * Sending strategy:
 *   - Fetch all active subscribers in one DB query
 *   - Send emails concurrently with Promise.allSettled so one
 *     failed delivery does not stop the rest
 *   - Log a summary of sent / failed counts
 * -----------------------------------------------------------------
 */

/* ─────────────────────────────────────────
   Internal helper — bulk send
───────────────────────────────────────── */
async function _bulkSend(templateFn, templateData, label) {
  try {
    const subscribers = await Subscriber.find({ active: true }).select('email').lean();

    if (!subscribers.length) {
      console.log(`[NOTIFY] No active subscribers — skipping ${label} notification.`);
      return;
    }

    console.log(`[NOTIFY] Sending ${label} notification to ${subscribers.length} subscriber(s)…`);

    const results = await Promise.allSettled(
      subscribers.map((sub) => {
        const { subject, html, text } = templateFn({ ...templateData, email: sub.email });
        return sendMail({ to: sub.email, subject, html, text });
      })
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[NOTIFY] ${label} — sent: ${sent}, failed: ${failed}`);

    // Log individual failures for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[NOTIFY] Failed to send to ${subscribers[i].email}:`, r.reason?.message);
      }
    });

  } catch (err) {
    console.error(`[NOTIFY] Bulk send error (${label}):`, err.message);
  }
}

/* ─────────────────────────────────────────
   notifyNewBook
   Called after a book is created.
   Pass the full saved book document.
───────────────────────────────────────── */
function notifyNewBook(book) {
  // Fire and forget — do NOT await this call
  _bulkSend(newBookEmail, { book }, 'new-book').catch(() => {});
}

/* ─────────────────────────────────────────
   notifyNewArticle
   Called after a new article is published.
   Pass an object with: { title, slug, excerpt }
───────────────────────────────────────── */
function notifyNewArticle(article) {
  // Fire and forget — do NOT await this call
  _bulkSend(newArticleEmail, { article }, 'new-article').catch(() => {});
}

module.exports = { notifyNewBook, notifyNewArticle };
