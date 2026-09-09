const User       = require("../models/User");
const Subscriber = require("../models/Subscriber");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const crypto     = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { sendMail } = require("../utils/mailer");
const { verifyEmailTemplate, resetPasswordTemplate } = require("../utils/emailTemplates");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

const issueAuthCookie = (res, user) => {
  const token = jwt.sign(
    { userId: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.cookie("bookstowa_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "None",
    maxAge:   24 * 60 * 60 * 1000,
  });
};

const sanitizeUser = (userDoc) => {
  const { password: _pw, ...safe } = userDoc.toObject();
  return safe;
};

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates account, sends verification email. Does NOT log in yet.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        code:    "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a 6-digit verification code
    const verificationCode    = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name,
      email,
      password:                 hashedPassword,
      emailVerified:            false,
      emailVerificationCode:    verificationCode,
      emailVerificationExpires: verificationExpires,
    });

    // Auto-subscribe to newsletter
    try {
      await Subscriber.findOneAndUpdate(
        { email: user.email },
        {
          $setOnInsert: {
            email:  user.email,
            source: 'user_registration',
            userId: user._id,
            active: true,
          },
        },
        { upsert: true, new: false }
      );
    } catch (subErr) {
      console.error('[NEWSLETTER] Auto-subscribe failed (register):', subErr.message);
    }

    // Send verification code email — fire and forget
    const { subject, html, text } = verifyEmailTemplate({
      email, code: verificationCode, name,
    });
    sendMail({ to: email, subject, html, text }).catch((err) => {
      console.error('[AUTH] Verification email failed:', err.message);
    });

    return res.status(201).json({
      code:    "EMAIL_VERIFICATION_REQUIRED",
      message: "Account created. Please check your email for your 6-digit verification code.",
    });
  } catch (error) {
    next(error);
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Block login until email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        code:    "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }

    issueAuthCookie(res, user);

    return res.status(200).json({
      message: "Login successful",
      user:    sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    res.clearCookie("bookstowa_token", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "None",
    });
    return res.status(200).json({ message: "Logout successful. Token cleared." });
  } catch (error) {
    next(error);
  }
};

// ── GET CURRENT USER ──────────────────────────────────────────────────────────
// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      message: "User data retrieved successfully",
      user:    sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ── GOOGLE AUTHENTICATION ─────────────────────────────────────────────────────
// POST /api/auth/google
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken:  credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        code:    "INVALID_GOOGLE_CREDENTIAL",
        message: "We couldn't verify your Google account. Please try again.",
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        message: "Google account did not provide an email address.",
      });
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        return res.status(409).json({
          code:    "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists. Please sign in with your email and password instead.",
        });
      }
      user = await User.create({
        name:     name || email.split("@")[0],
        email,
        password: null,
        googleId,
        avatar:   picture || "",
      });

      // Auto-subscribe new Google users to the newsletter
      try {
        await Subscriber.findOneAndUpdate(
          { email: user.email },
          {
            $setOnInsert: {
              email:  user.email,
              source: 'user_registration',
              userId: user._id,
              active: true,
            },
          },
          { upsert: true, new: false }
        );
        console.log(`[NEWSLETTER] Auto-subscribed on Google register: ${user.email}`);
      } catch (subErr) {
        // Never block registration because of a newsletter failure
        console.error('[NEWSLETTER] Auto-subscribe failed (google):', subErr.message);
      }
    }

    issueAuthCookie(res, user);

    return res.status(200).json({
      message: "Google authentication successful",
      user:    sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
// POST /api/auth/verify-email
// Body: { email, code }
// Validates the 6-digit code and activates the account.
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        code:    "MISSING_FIELDS",
        message: "Email and verification code are required.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({
        code:    "INVALID_CODE",
        message: "Invalid email or verification code.",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        code:    "EMAIL_ALREADY_VERIFIED",
        message: "Your email is already verified. You can log in.",
      });
    }

    if (user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        code:    "CODE_EXPIRED",
        message: "This verification code has expired. Please request a new one.",
      });
    }

    if (user.emailVerificationCode !== String(code).trim()) {
      return res.status(400).json({
        code:    "INVALID_CODE",
        message: "Incorrect verification code. Please check your email and try again.",
      });
    }

    user.emailVerified            = true;
    user.emailVerificationCode    = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.status(200).json({
      code:    "EMAIL_VERIFIED",
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

// ── RESEND VERIFICATION EMAIL ─────────────────────────────────────────────────
// POST /api/auth/resend-verification
// Lets a user request a fresh verification email if the previous one expired.
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return res.status(200).json({
        message: "If that email exists and is unverified, a new link has been sent.",
      });
    }

    const newCode    = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationCode    = newCode;
    user.emailVerificationExpires = newExpires;
    await user.save();

    const { subject, html, text } = verifyEmailTemplate({
      email: user.email, code: newCode, name: user.name,
    });
    sendMail({ to: user.email, subject, html, text }).catch((err) => {
      console.error('[AUTH] Resend verification email failed:', err.message);
    });

    return res.status(200).json({
      message: "If that email exists and is unverified, a new link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Sends a password reset link. Always returns success (no email enumeration).
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Return success regardless — never reveal whether email exists
    if (!user || !user.password) {
      return res.status(200).json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    const resetToken   = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken   = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const { subject, html, text } = resetPasswordTemplate({
      email: user.email, token: resetToken, name: user.name,
    });
    sendMail({ to: user.email, subject, html, text }).catch((err) => {
      console.error('[AUTH] Password reset email failed:', err.message);
    });

    return res.status(200).json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// Validates the reset token and sets a new password.
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ resetPasswordToken: token });

    if (!user) {
      return res.status(400).json({
        code:    "INVALID_RESET_TOKEN",
        message: "This reset link is invalid.",
      });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({
        code:    "RESET_TOKEN_EXPIRED",
        message: "This reset link has expired. Please request a new one.",
      });
    }

    user.password             = await bcrypt.hash(password, 10);
    user.resetPasswordToken   = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      code:    "PASSWORD_RESET",
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};
