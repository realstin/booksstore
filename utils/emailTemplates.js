/**
 * emailTemplates.js
 * -----------------------------------------------------------------
 * Clean, minimal HTML email templates for BookStore notifications.
 *
 * Design principles:
 *   - Table-based layout for maximum email client compatibility
 *   - Inline styles only (Gmail strips <style> blocks)
 *   - Black/white/neutral palette — matches the BookStore brand
 *   - Every template includes an unsubscribe footer link
 * -----------------------------------------------------------------
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookstowa.vercel.app';

/* ─────────────────────────────────────────
   Shared shell — wraps every template
───────────────────────────────────────── */
function shell(content, email) {
  const unsubscribeUrl = `${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BookStore</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">

          <!-- Header -->
          <tr>
            <td style="background:#0f1419;padding:28px 40px;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">
                BookStore
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f0f0f0;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">
                You are receiving this email because you subscribed to BookStore updates.<br />
                <a href="${unsubscribeUrl}" style="color:#737373;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${FRONTEND_URL}" style="color:#737373;text-decoration:underline;">Visit BookStore</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ─────────────────────────────────────────
   1. WELCOME EMAIL
   Sent when a visitor subscribes via the footer form.
───────────────────────────────────────── */
function welcomeEmail({ email }) {
  const content = `
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#0f1419;letter-spacing:-0.025em;line-height:1.2;">
      Welcome to BookStore.
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#737373;line-height:1.75;">
      You are now subscribed to BookStore updates. You will be the first to know
      when we add new technology books, publish articles, and share learning resources.
    </p>
    <p style="margin:0 0 32px;font-size:15px;color:#737373;line-height:1.75;">
      In the meantime, explore our current library of trusted technology books.
    </p>
    <a href="${FRONTEND_URL}"
       style="display:inline-block;background:#0f1419;color:#ffffff;font-size:14px;font-weight:600;
              padding:14px 28px;border-radius:100px;text-decoration:none;letter-spacing:-0.01em;">
      Explore Books →
    </a>
  `;

  return {
    subject: 'Welcome to BookStore — you are subscribed',
    html:    shell(content, email),
    text:    `Welcome to BookStore!\n\nYou are now subscribed to updates.\nExplore books: ${FRONTEND_URL}\n\nUnsubscribe: ${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`,
  };
}

/* ─────────────────────────────────────────
   2. NEW BOOK NOTIFICATION
   Sent to all active subscribers when a new book is added.
───────────────────────────────────────── */
function newBookEmail({ email, book }) {
  const authors  = Array.isArray(book.authors) && book.authors.length
    ? book.authors.join(', ')
    : 'BookStore Team';

  const category = Array.isArray(book.categories) && book.categories.length
    ? book.categories[0]
    : 'Technology';

  const bookUrl  = `${FRONTEND_URL}/books/${book._id}`;

  const coverHtml = book.coverImage
    ? `<img src="${book.coverImage}" alt="Cover of ${book.title}"
           style="width:80px;height:107px;object-fit:cover;border-radius:8px;border:1px solid #e5e5e5;
                  float:left;margin:0 20px 8px 0;" />`
    : '';

  const content = `
    <p style="margin:0 0 20px;font-size:12px;font-weight:600;text-transform:uppercase;
              letter-spacing:0.14em;color:#a3a3a3;">
      New Book Added
    </p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#0f1419;
               letter-spacing:-0.025em;line-height:1.2;">
      A new book just landed on BookStore.
    </h1>
    <table cellpadding="0" cellspacing="0" width="100%"
           style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;
                  padding:24px;margin-bottom:32px;">
      <tr>
        <td>
          ${coverHtml}
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.12em;color:#a3a3a3;">${category}</p>
          <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#0f1419;
                    letter-spacing:-0.02em;line-height:1.3;">${book.title}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#737373;">${authors}</p>
          ${book.description
            ? `<p style="margin:0;font-size:13px;color:#a3a3a3;line-height:1.7;">
                ${book.description.slice(0, 200)}${book.description.length > 200 ? '…' : ''}
               </p>`
            : ''}
          <div style="clear:both;"></div>
        </td>
      </tr>
    </table>
    <a href="${bookUrl}"
       style="display:inline-block;background:#0f1419;color:#ffffff;font-size:14px;font-weight:600;
              padding:14px 28px;border-radius:100px;text-decoration:none;letter-spacing:-0.01em;">
      View Book →
    </a>
  `;

  return {
    subject: `New book: ${book.title}`,
    html:    shell(content, email),
    text:    `New book added to BookStore!\n\n${book.title}\nBy ${authors}\n\nView it here: ${bookUrl}\n\nUnsubscribe: ${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`,
  };
}

/* ─────────────────────────────────────────
   3. NEW ARTICLE NOTIFICATION
   Sent to all active subscribers when a new article is published.
───────────────────────────────────────── */
function newArticleEmail({ email, article }) {
  const articleUrl = `${FRONTEND_URL}/news/${article.slug}`;

  const content = `
    <p style="margin:0 0 20px;font-size:12px;font-weight:600;text-transform:uppercase;
              letter-spacing:0.14em;color:#a3a3a3;">
      New Article
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f1419;
               letter-spacing:-0.025em;line-height:1.2;">
      ${article.title}
    </h1>
    ${article.excerpt
      ? `<p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.75;">
           ${article.excerpt}
         </p>`
      : '<div style="margin-bottom:28px;"></div>'}
    <a href="${articleUrl}"
       style="display:inline-block;background:#0f1419;color:#ffffff;font-size:14px;font-weight:600;
              padding:14px 28px;border-radius:100px;text-decoration:none;letter-spacing:-0.01em;">
      Read Article →
    </a>
  `;

  return {
    subject: `New article: ${article.title}`,
    html:    shell(content, email),
    text:    `New article on BookStore!\n\n${article.title}\n\n${article.excerpt || ''}\n\nRead it here: ${articleUrl}\n\nUnsubscribe: ${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`,
  };
}

/* ─────────────────────────────────────────
   4. EMAIL VERIFICATION — 6-digit code
   Sent when a new user registers (email/password).
   Code is valid for 24 hours.
───────────────────────────────────────── */
function verifyEmailTemplate({ email, code, name }) {
  const digits = String(code).split('');

  const digitBoxes = digits.map(d =>
    `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;
                  font-size:28px;font-weight:700;color:#0f1419;background:#f5f5f5;
                  border-radius:10px;border:1px solid #e5e5e5;margin:0 4px;
                  letter-spacing:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
       ${d}
     </span>`
  ).join('');

  const content = `
    <p style="margin:0 0 20px;font-size:12px;font-weight:600;text-transform:uppercase;
              letter-spacing:0.14em;color:#a3a3a3;">
      Email Verification
    </p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0f1419;
               letter-spacing:-0.025em;line-height:1.2;">
      Verify your email address.
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.75;">
      Hi ${name || 'there'}, use the verification code below to activate your BookStore account.
      This code expires in <strong style="color:#0f1419;">24 hours</strong>.
    </p>

    <!-- Code display -->
    <div style="text-align:center;margin:0 0 28px;">
      ${digitBoxes}
    </div>

    <p style="margin:0 0 8px;font-size:13px;color:#a3a3a3;text-align:center;">
      Enter this code on the verification page.
    </p>
    <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;text-align:center;">
      If you did not create a BookStore account you can safely ignore this email.
    </p>
  `;

  return {
    subject: `${code} is your BookStore verification code`,
    html:    shell(content, email),
    text:    `Hi ${name || 'there'},\n\nYour BookStore verification code is: ${code}\n\nThis code expires in 24 hours.\n\nIf you did not create an account, ignore this email.`,
  };
}

/* ─────────────────────────────────────────
   5. PASSWORD RESET
   Sent when a user requests a password reset.
   Contains a one-click reset link valid for 1 hour.
───────────────────────────────────────── */
function resetPasswordTemplate({ email, token, name }) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  const content = `
    <p style="margin:0 0 20px;font-size:12px;font-weight:600;text-transform:uppercase;
              letter-spacing:0.14em;color:#a3a3a3;">
      Password Reset
    </p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0f1419;
               letter-spacing:-0.025em;line-height:1.2;">
      Reset your password.
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.75;">
      Hi ${name || 'there'}, we received a request to reset your BookStore password.
      Click the button below to choose a new one.
      This link expires in <strong style="color:#0f1419;">1 hour</strong>.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#0f1419;color:#ffffff;font-size:14px;font-weight:600;
              padding:14px 28px;border-radius:100px;text-decoration:none;letter-spacing:-0.01em;">
      Reset Password
    </a>
    <p style="margin:28px 0 0;font-size:12px;color:#a3a3a3;line-height:1.6;">
      Or copy and paste this link into your browser:<br />
      <span style="color:#737373;word-break:break-all;">${resetUrl}</span>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#a3a3a3;line-height:1.6;">
      If you did not request a password reset you can safely ignore this email.
      Your password will not change.
    </p>
  `;

  return {
    subject: 'Reset your BookStore password',
    html:    shell(content, email),
    text:    `Hi ${name || 'there'},\n\nReset your BookStore password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
  };
}

module.exports = {
  welcomeEmail,
  newBookEmail,
  newArticleEmail,
  verifyEmailTemplate,
  resetPasswordTemplate,
};
