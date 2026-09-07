const crypto = require("crypto");
const User   = require("../models/User");
const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");

// Reusable Google OAuth2 client — only needs the client ID for token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure URL-safe token.
 * Returns the plain token (sent in the email link) and its SHA-256 hash
 * (stored in the DB so the raw token is never persisted).
 */
const generateToken = () => {
  const plain  = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(plain).digest("hex");
  return { plain, hashed };
};

/**
 * Issue the BookStore JWT and set the HTTP-only cookie.
 * Centralised here so register (post-verify), login, and googleAuth
 * all behave identically.
 */
const issueAuthCookie = (res, user) => {
  const token = jwt.sign(
    { userId: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.cookie("bookstowa_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
    maxAge: 24 * 60 * 60 * 1000,
  });
};

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates account, sends verification email — does NOT log the user in yet.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check for existing verified account with this email
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified) {
      return res.status(409).json({
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Generate verification token (store hash, send plain)
    const { plain: plainToken, hashed: hashedToken } = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. If an unverified account already exists for this email, update it
    //    (user re-registered before verifying — refresh token + password)
    let user;
    if (existingUser && !existingUser.emailVerified) {
      existingUser.password               = hashedPassword;
      existingUser.verificationToken      = hashedToken;
      existingUser.verificationTokenExpiry = expiry;
      user = await existingUser.save();
    } else {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken:       hashedToken,
        verificationTokenExpiry: expiry,
      });
    }

    // 5. Respond to the client immediately — don't make them wait for the email
    res.status(201).json({
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Account created. Please check your email to verify your address before signing in.",
    });

    // 6. Send verification email after response is flushed (non-blocking)
    sendVerificationEmail(email, plainToken).catch((emailErr) => {
      console.error("Failed to send verification email:", emailErr.message);
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

    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2. Google-only accounts have no password
    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    // 3. Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4. Block unverified accounts
    if (!user.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before signing in. Check your inbox for the verification link.",
      });
    }

    // 5. Issue JWT cookie
    issueAuthCookie(res, user);

    // 6. Return safe user data
    const { password: _pw, verificationToken: _vt, verificationTokenExpiry: _vte,
            passwordResetToken: _prt, passwordResetExpiry: _pre, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "Login successful",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=<plain_token>
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        code: "MISSING_TOKEN",
        message: "Verification token is required.",
      });
    }

    // Hash the incoming token to match what's stored in the DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({ verificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        code: "INVALID_VERIFICATION_TOKEN",
        message: "This verification link is invalid or has already been used.",
      });
    }

    // Check expiry
    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        code: "VERIFICATION_TOKEN_EXPIRED",
        message: "This verification link has expired. Please register again to receive a new one.",
      });
    }

    // Already verified (edge case: concurrent requests)
    if (user.emailVerified) {
      return res.status(200).json({
        code: "EMAIL_ALREADY_VERIFIED",
        message: "Your email address is already verified.",
      });
    }

    // Mark verified and clear token fields
    user.emailVerified            = true;
    user.verificationToken        = null;
    user.verificationTokenExpiry  = null;
    await user.save();

    return res.status(200).json({
      code: "EMAIL_VERIFIED",
      message: "Email verified successfully. You can now sign in.",
    });

  } catch (error) {
    next(error);
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Always returns 200 to prevent email enumeration.
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always respond the same way — don't reveal whether the email exists
    const genericResponse = {
      message: "If an account with that email exists, we've sent a password reset link.",
    };

    if (!user || !user.emailVerified || !user.password) {
      // No account, unverified account, or Google-only account — silently skip
      return res.status(200).json(genericResponse);
    }

    // Generate reset token (store hash, send plain)
    const { plain: plainToken, hashed: hashedToken } = generateToken();
    user.passwordResetToken  = hashedToken;
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Respond immediately — don't make the user wait for the email
    res.status(200).json(genericResponse);

    // Send reset email after response is flushed (non-blocking)
    sendPasswordResetEmail(email, plainToken).catch((emailErr) => {
      console.error("Failed to send password reset email:", emailErr.message);
    });

  } catch (error) {
    next(error);
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // Hash the incoming token to look up in DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({ passwordResetToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        code: "INVALID_RESET_TOKEN",
        message: "This password reset link is invalid or has already been used.",
      });
    }

    if (user.passwordResetExpiry < new Date()) {
      return res.status(400).json({
        code: "RESET_TOKEN_EXPIRED",
        message: "This password reset link has expired. Please request a new one.",
      });
    }

    // Hash new password and clear reset token fields
    user.password            = await bcrypt.hash(password, 10);
    user.passwordResetToken  = null;
    user.passwordResetExpiry = null;
    await user.save();

    return res.status(200).json({
      code: "PASSWORD_RESET_SUCCESS",
      message: "Password reset successfully. You can now sign in with your new password.",
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
      secure: process.env.NODE_ENV === "production",
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

    const { password: _pw, verificationToken: _vt, verificationTokenExpiry: _vte,
            passwordResetToken: _prt, passwordResetExpiry: _pre, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "User data retrieved successfully",
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// ── GOOGLE AUTHENTICATION ─────────────────────────────────────────────────────
// POST /api/auth/google
// Google users skip email verification — Google already verified the address.
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    // 1. Verify token with Google — never trust frontend-provided identity claims
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        code: "INVALID_GOOGLE_CREDENTIAL",
        message: "We couldn't verify your Google account. Please try again.",
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        message: "Google account did not provide an email address.",
      });
    }

    // 2. Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        // Email belongs to an existing password account — reject, do not auto-link
        return res.status(409).json({
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists. Please sign in with your email and password instead.",
        });
      }

      // Brand new Google user — emailVerified true (Google already verified it)
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        password: null,
        googleId,
        avatar: picture || "",
        emailVerified: true,
      });
    }

    // 3. Issue BookStore JWT cookie
    issueAuthCookie(res, user);

    // 4. Return safe user data
    const { password: _pw, verificationToken: _vt, verificationTokenExpiry: _vte,
            passwordResetToken: _prt, passwordResetExpiry: _pre, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "Google authentication successful",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};
