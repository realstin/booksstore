const Subscriber = require('../models/Subscriber');
const { sendMail } = require('./mailer');
const { newBookEmail, newArticleEmail } = require('./emailTemplates');
const logger = require('./logger');

/**
 * notifySubscribers
 * -----------------------------------------------------------------
 * Sends email notifications to all active subscribers.
 * Fire-and-forget pattern — errors are logged, never thrown to callers.
 */

// ── Shared helper ─────────────────────────────────────────────────────────────

async function getActiveSubscribers() {
  return Subscriber.find({ active: true }).select('email').lean();
}

// ── Notify: New Book ──────────────────────────────────────────────────────────

async function notifyNewBook(book) {
  try {
    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
      logger.info('[NOTIFY] No active subscribers — skipping book notification');
      return;
    }

    const results = await Promise.allSettled(
      subscribers.map((subscriber) => {
        const { subject, html, text } = newBookEmail({ email: subscriber.email, book });
        return sendMail({ to: subscriber.email, subject, html, text }).catch((err) => {
          logger.error(
            { err, email: subscriber.email, bookId: book._id },
            '[NOTIFY] Failed to send book notification to subscriber'
          );
        });
      })
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info(
      { bookId: book._id, total: subscribers.length, sent, failed },
      '[NOTIFY] Book notification complete'
    );
  } catch (err) {
    logger.error({ err, bookId: book._id }, '[NOTIFY] notifyNewBook failed');
  }
}

// ── Notify: New Article ───────────────────────────────────────────────────────

async function notifyNewArticle(article) {
  try {
    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
      logger.info('[NOTIFY] No active subscribers — skipping article notification');
      return;
    }

    const results = await Promise.allSettled(
      subscribers.map((subscriber) => {
        const { subject, html, text } = newArticleEmail({ email: subscriber.email, article });
        return sendMail({ to: subscriber.email, subject, html, text }).catch((err) => {
          logger.error(
            { err, email: subscriber.email, articleId: article._id },
            '[NOTIFY] Failed to send article notification to subscriber'
          );
        });
      })
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info(
      { articleId: article._id, total: subscribers.length, sent, failed },
      '[NOTIFY] Article notification complete'
    );
  } catch (err) {
    logger.error({ err, articleId: article._id }, '[NOTIFY] notifyNewArticle failed');
  }
}

module.exports = {
  notifyNewBook,
  notifyNewArticle,
};
