const Subscriber = require('../models/Subscriber');
const { sendMail } = require('./mailer');
const { newBookEmail, newArticleEmail } = require('./emailTemplates');
const logger = require('./logger');

/**
 * notifySubscribers
 * -----------------------------------------------------------------
 * Sends email notifications to all active subscribers.
 * Fire-and-forget pattern — errors are logged, never thrown to callers.
 *
 * Delivery strategy:
 *   - Sends in batches of BATCH_SIZE to avoid hitting Gmail's concurrent
 *     connection limit (firing 20+ emails at once causes socket drops).
 *   - Waits BATCH_DELAY_MS between batches to stay within Gmail's
 *     rate limits.
 *   - Retries each failed send once after RETRY_DELAY_MS. Transient
 *     errors (421 Temporary System Problem, socket close) are recoverable
 *     on a second attempt.
 * -----------------------------------------------------------------
 */

const BATCH_SIZE     = 5;    // emails sent in parallel per batch
const BATCH_DELAY_MS = 2000; // wait between batches (2 seconds)
const RETRY_DELAY_MS = 3000; // wait before retrying a failed send (3 seconds)

// ── Shared helpers ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveSubscribers() {
  return Subscriber.find({ active: true }).select('email').lean();
}

/**
 * sendWithRetry — attempts to send one email, retries once on failure.
 *
 * Returns { success: true } or { success: false, email, err }.
 */
async function sendWithRetry({ to, subject, html, text }) {
  try {
    await sendMail({ to, subject, html, text });
    return { success: true };
  } catch (firstErr) {
    // Wait before retrying — gives Gmail time to recover from
    // transient issues (421, socket drops).
    await sleep(RETRY_DELAY_MS);
    try {
      await sendMail({ to, subject, html, text });
      return { success: true };
    } catch (retryErr) {
      return { success: false, email: to, err: retryErr };
    }
  }
}

/**
 * sendInBatches — sends an array of email jobs in small batches
 * with a delay between each batch.
 *
 * Each job is { to, subject, html, text }.
 * Returns { sent, failed } counts.
 */
async function sendInBatches(jobs, label) {
  let sent   = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch      = jobs.slice(i, i + BATCH_SIZE);
    const batchNum   = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatch = Math.ceil(jobs.length / BATCH_SIZE);

    logger.info(
      { batch: batchNum, of: totalBatch, size: batch.length },
      `[NOTIFY] ${label} — sending batch`
    );

    const results = await Promise.all(batch.map((job) => sendWithRetry(job)));

    for (const result of results) {
      if (result.success) {
        sent++;
      } else {
        failed++;
        logger.error(
          { email: result.email, err: result.err },
          `[NOTIFY] ${label} — failed after retry`
        );
      }
    }

    // Pause between batches — skip the delay after the last batch.
    if (i + BATCH_SIZE < jobs.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { sent, failed };
}

// ── Notify: New Book ──────────────────────────────────────────────────────────

async function notifyNewBook(book) {
  try {
    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
      logger.info('[NOTIFY] No active subscribers — skipping book notification');
      return;
    }

    const jobs = subscribers.map((subscriber) => {
      const { subject, html, text } = newBookEmail({ book });
      return { to: subscriber.email, subject, html, text };
    });

    logger.info(
      { bookId: book._id, total: jobs.length },
      '[NOTIFY] Starting book notification'
    );

    const { sent, failed } = await sendInBatches(jobs, 'book');

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

    const jobs = subscribers.map((subscriber) => {
      const { subject, html, text } = newArticleEmail({ article });
      return { to: subscriber.email, subject, html, text };
    });

    logger.info(
      { articleId: article._id, total: jobs.length },
      '[NOTIFY] Starting article notification'
    );

    const { sent, failed } = await sendInBatches(jobs, 'article');

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
