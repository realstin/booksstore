const nodemailer = require("nodemailer");

// ── TRANSPORTER ──────────────────────────────────────────────────────────────
// Built once at module load. Uses SMTP credentials from environment variables.
// Compatible with Gmail, Outlook, SendGrid SMTP, Resend SMTP, Mailgun, etc.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  // true for port 465 (SSL), false for 587 (STARTTLS) — driven by EMAIL_SECURE
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── SEND VERIFICATION EMAIL ───────────────────────────────────────────────────
// Sends a branded BookStore email containing the verification link.
// verificationUrl already includes the raw token as a query param.
// We never log the URL or the token.
const sendVerificationEmail = async (email, name, verificationUrl) => {
  const firstName = name ? name.split(" ")[0] : "there";

  const mailOptions = {
    from: `"BookStore" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your BookStore email address",
    // Plain-text fallback for email clients that don't render HTML
    text: `
Hi ${firstName},

Welcome to BookStore! Please verify your email address by visiting the link below:

${verificationUrl}

This link expires in 24 hours. If you did not create a BookStore account, you can safely ignore this email.

— The BookStore Team
    `.trim(),
    // HTML version
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;
                         letter-spacing:-0.5px;">
                📚 BookStore
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Welcome to BookStore! You're almost ready. Just verify your email
                address and you'll be all set to explore, save, and enjoy books.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background:#111827;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;padding:14px 32px;
                              font-size:15px;font-weight:600;color:#ffffff;
                              text-decoration:none;border-radius:8px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#6b7280;word-break:break-all;">
                ${verificationUrl}
              </p>

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                This link expires in <strong>24 hours</strong>. If you did not
                create a BookStore account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;
                       border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} BookStore. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };

  // Throws on SMTP failure — caller (authController) passes error to next(err)
  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
