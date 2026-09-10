const nodemailer = require('nodemailer');
const logger     = require('./logger');

/**
 * mailer.js
 * -----------------------------------------------------------------
 * Nodemailer transporter configured for Gmail SMTP.
 *
 * Prerequisites (already in .env):
 *   GMAIL_USER         — your Gmail address
 *   GMAIL_APP_PASSWORD — 16-character App Password from Google
 *                        (Google Account → Security → App Passwords)
 *                        NOT your regular Gmail password.
 *
 * The transporter is created once as a module singleton.
 * Nodemailer reuses the SMTP connection pool automatically.
 * -----------------------------------------------------------------
 */

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   465,
  secure: true, // port 465 uses SSL — not blocked by Render's free tier
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * sendMail — thin wrapper around transporter.sendMail.
 *
 * @param {object} options
 * @param {string|string[]} options.to      — recipient(s)
 * @param {string}          options.subject — email subject
 * @param {string}          options.html    — HTML body
 * @param {string}          [options.text]  — plain-text fallback (optional)
 * @returns {Promise}
 */
async function sendMail({ to, subject, html, text }) {
  logger.info({ to, subject }, '[MAILER] Sending email');

  try {
    const info = await transporter.sendMail({
      from: `"BookStore" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || '',
    });
    logger.info({ to, messageId: info.messageId }, '[MAILER] Email sent successfully');
    return info;
  } catch (err) {
    // Log structured details so the exact failure reason appears in logs
    // without leaking secret values — we log whether the env vars are SET,
    // not their actual content.
    logger.error(
      {
        err,
        to,
        code:                    err.code || 'N/A',
        gmailUserSet:            !!process.env.GMAIL_USER,
        gmailAppPasswordSet:     !!process.env.GMAIL_APP_PASSWORD,
        gmailAppPasswordLength:  (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '').length,
      },
      '[MAILER] Failed to send email'
    );
    throw err;
  }
}

/**
 * verifyConnection — checks that the Gmail credentials are valid.
 * Called once on server startup so misconfiguration is caught early.
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('[MAILER] Gmail SMTP connection verified successfully');
  } catch (err) {
    // Log but never crash the server — email is non-critical
    logger.error({ err }, '[MAILER] Gmail SMTP verification failed — check GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  }
}

module.exports = { sendMail, verifyConnection };
