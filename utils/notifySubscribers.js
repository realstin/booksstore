const Subscriber = require('../models/Subscriber');
const { sendEmail } = require('./mailer');
const logger = require('./logger');

/**
 * notifySubscribers
 * -----------------------------------------------------------------
 * Sends email notifications to active subscribers when new articles are published.
 * Fire-and-forget pattern — errors are logged but don't block the caller.
 */

/**
 * Notify all active subscribers about a new article
 * @param {Object} article - The article document
 */
async function notifyNewArticle(article) {
  try {
    // Get all active subscribers
    const subscribers = await Subscriber.find({ status: 'active' }).select('email');

    if (subscribers.length === 0) {
      logger.info('[NOTIFY] No active subscribers to notify');
      return;
    }

    const emailPromises = subscribers.map((subscriber) => {
      const subject = `New Article: ${article.title}`;
      const html = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #0a0a0a;">
            ${article.title}
          </h1>
          
          ${article.subtitle ? `
            <p style="font-size: 16px; color: #525252; margin-bottom: 16px;">
              ${article.subtitle}
            </p>
          ` : ''}
          
          <p style="font-size: 14px; color: #737373; margin-bottom: 24px;">
            ${article.excerpt}
          </p>
          
          <div style="margin-bottom: 24px;">
            <a href="${process.env.FRONTEND_URL || 'https://bookstowa.vercel.app'}/news/${article.slug}" 
               style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
              Read Article
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
          
          <p style="font-size: 12px; color: #a3a3a3; margin-bottom: 8px;">
            You're receiving this because you subscribed to Bookstowa updates.
          </p>
          
          <p style="font-size: 12px; color: #a3a3a3;">
            <a href="${process.env.FRONTEND_URL || 'https://bookstowa.vercel.app'}/unsubscribe?email=${subscriber.email}" 
               style="color: #0a0a0a; text-decoration: underline;">
              Unsubscribe
            </a>
          </p>
        </div>
      `;

      return sendEmail(subscriber.email, subject, html).catch((err) => {
        logger.error(
          { err, email: subscriber.email, articleId: article._id },
          '[NOTIFY] Failed to send article notification'
        );
      });
    });

    await Promise.allSettled(emailPromises);
    logger.info(
      { articleId: article._id, subscriberCount: subscribers.length },
      '[NOTIFY] Article notification emails sent'
    );
  } catch (err) {
    logger.error({ err, articleId: article._id }, '[NOTIFY] Failed to notify subscribers');
  }
}

module.exports = {
  notifyNewArticle,
};
