const axios = require("axios");

// ── Resend HTTP API ───────────────────────────────────────────────────────────
// Uses Resend's REST API over HTTPS (port 443) instead of SMTP.
// Render free tier blocks all outbound SMTP (465/587) but never blocks port 443.
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_API_URL = "https://api.resend.com/emails";

const sendEmail = async ({ to, subject, html }) => {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromAddr = process.env.EMAIL_FROM || "BookStore <onboarding@resend.dev>";

  if (!apiKey) throw new Error("RESEND_API_KEY environment variable is not set.");

  await axios.post(
    RESEND_API_URL,
    { from: fromAddr, to, subject, html },
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      timeout: 10000, // 10 s — HTTP so this is plenty
    }
  );
};

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND_NAME  = "BookStore";
const BRAND_COLOR = "#0f1419";

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
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${BRAND_COLOR};">${BRAND_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>
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
exports.sendVerificationEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyUrl   = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const html = emailShell(`
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
    </p>`);

  await sendEmail({
    to,
    subject: "Verify your BookStore email address",
    html,
  });
};

// ── Send password reset email ─────────────────────────────────────────────────
exports.sendPasswordResetEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl    = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = emailShell(`
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
    </p>`);

  await sendEmail({
    to,
    subject: "Reset your BookStore password",
    html,
  });
};
