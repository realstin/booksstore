const nodemailer = require('nodemailer');

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
  return transporter.sendMail({
    from: `"BookStore" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: text || '',
  });
}

/**
 * verifyConnection — checks that the Gmail credentials are valid.
 * Called once on server startup so misconfiguration is caught early.
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('[MAILER] Gmail SMTP connection verified successfully.');
  } catch (err) {
    // Log but never crash the server — email is non-critical
    console.error('[MAILER] Gmail SMTP verification failed:', err.message);
    console.error('[MAILER] Check GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  }
}

module.exports = { sendMail, verifyConnection };
