const nodemailer = require("nodemailer");

// ── Transporter ───────────────────────────────────────────────────────────────
// Resend SMTP — port 465 (SSL). Works on Render free tier.
// Render blocks outbound Gmail SMTP (port 587) but never blocks port 465 to
// smtp.resend.com because it goes over standard HTTPS infrastructure.
//
// Setup (free, no credit card needed — 3,000 emails/month, 100/day):
//   1. Sign up at https://resend.com
//   2. API Keys → Create API key → copy it
//   3. Add RESEND_API_KEY to your Render environment variables
//   4. Set EMAIL_FROM to: BookStore <onboarding@resend.dev>
//      (the resend.dev domain works on the free plan with no verification needed)

const createTransporter = () =>
  nodemailer.createTransport({
    host:   "smtp.resend.com",
    port:   465,
    secure: true,     // SSL — required for port 465
    auth: {
      user: "resend", // always the literal string "resend"
      pass: process.env.RESEND_API_KEY,
    },
  });

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND_NAME  = "BookStore";
const BRAND_COLOR = "#0f1419";

// ── Shared HTML email shell ───────────────────────────────────────────────────
const emailShell = (bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${BRAND_COLOR};">${BRAND_NAME}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f3f4f6;background:#fafaf9;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">
                You received this email because an account action was requested on ${BRAND_NAME}.
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Send verification email ───────────────────────────────────────────────────
/**
 * @param {string} to     - recipient email address
 * @param {string} token  - raw (plain) verification token — NOT the hash
 */
exports.sendVerificationEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyUrl   = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_COLOR};letter-spacing:-0.3px;">
      Verify your email address
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
      Thanks for signing up. Click the button below to verify your email address
      and activate your account. This link expires in
      <strong style="color:${BRAND_COLOR};">24 hours</strong>.
    </p>
    <a href="${verifyUrl}"
       style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:100px;">
      Verify email address
    </a>
    <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
      Or copy this link into your browser:<br/>
      <a href="${verifyUrl}" style="color:#6b7280;word-break:break-all;">${verifyUrl}</a>
    </p>`;

  await createTransporter().sendMail({
    from:    process.env.EMAIL_FROM || `"${BRAND_NAME}" <onboarding@resend.dev>`,
    to,
    subject: "Verify your BookStore email address",
    html:    emailShell(body),
  });
};

// ── Send password reset email ─────────────────────────────────────────────────
/**
 * @param {string} to     - recipient email address
 * @param {string} token  - raw (plain) reset token — NOT the hash
 */
exports.sendPasswordResetEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl    = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_COLOR};letter-spacing:-0.3px;">
      Reset your password
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
      We received a request to reset the password for your ${BRAND_NAME} account.
      Click the button below to choose a new password. This link expires in
      <strong style="color:${BRAND_COLOR};">1 hour</strong>.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:100px;">
      Reset password
    </a>
    <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
      Or copy this link into your browser:<br/>
      <a href="${resetUrl}" style="color:#6b7280;word-break:break-all;">${resetUrl}</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#d1d5db;">
      If you did not request a password reset, no action is needed — your password remains unchanged.
    </p>`;

  await createTransporter().sendMail({
    from:    process.env.EMAIL_FROM || `"${BRAND_NAME}" <onboarding@resend.dev>`,
    to,
    subject: "Reset your BookStore password",
    html:    emailShell(body),
  });
};
