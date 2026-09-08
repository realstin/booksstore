const crypto = require("crypto");
const User   = require("../models/User");
const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");

// Reusable Google OAuth2 client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure token pair.
 * plain  → sent inside the email link (never stored in DB)
 * hashed → SHA-256 of plain, stored in DB so the raw value is never persisted
 */
const generateToken = () => {
  const plain  = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(plain).digest("hex");
  return { plain, hashed };
};

/**
 * Strip all sensitive fields before sending a user object to the client.
 */
const sanitizeUser = (userDoc) => {
  const {
    password: _pw,
    verificationToken: _vt,
    verificationTokenExpiry: _vte,
    passwordResetToken: _prt,
    passwordResetExpiry: _pre,
    ...safe
  } = userDoc.toObject();
  return safe;
};

/**
 * Sign a JWT and set the HTTP-only cookie.
 * Centralised so register (post-verify path is not used — login handles it),
 * login, and googleAuth all behave identically.
 */
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

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates the account, sends a verification email, and returns immediately.
// The user is NOT logged in until they verify their email.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    // Reject if a verified account already exists for this email
    if (existingUser && existingUser.emailVerified) {
      return res.status(409).json({
        code:    "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { plain: plainToken, hashed: hashedToken } = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let user;
    if (existingUser && !existingUser.emailVerified) {
      // Unverified account re-registering — refresh credentials and token
      existingUser.name                    = name;
      existingUser.password                = hashedPassword;
      existingUser.verificationToken       = hashedToken;
      existingUser.verificationTokenExpiry = expiry;
      user = await existingUser.save();
    } else {
      user = await User.create({
        name,
        email,
        password:                hashedPassword,
        emailVerified:           false,
        verificationToken:       hashedToken,
        verificationTokenExpiry: expiry,
      });
    }

    // Respond to the client immediately — do not await the email
    res.status(201).json({
      code:    "EMAIL_VERIFICATION_REQUIRED",
      message: "Account created. Please check your email to verify your address before signing in.",
    });

    // Send email after the response is already on its way (non-blocking)
    sendVerificationEmail(email, plainToken).catch((err) =>
      console.error("[register] Failed to send verification email:", err.message)
    );

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
        code:    "MISSING_TOKEN",
        message: "Verification token is required.",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user        = await User.findOne({ verificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        code:    "INVALID_VERIFICATION_TOKEN",
        message: "This verification link is invalid or has already been used.",
      });
    }

    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        code:    "VERIFICATION_TOKEN_EXPIRED",
        message: "This verification link has expired. Please sign up again to get a new one.",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        code:    "EMAIL_ALREADY_VERIFIED",
        message: "Your email address is already verified.",
      });
    }

    user.emailVerified           = true;
    user.verificationToken       = null;
    user.verificationTokenExpiry = null;
    await user.save();

    return res.status(200).json({
      code:    "EMAIL_VERIFIED",
      message: "Email verified successfully. You can now sign in.",
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

    // Google-only accounts have no password
    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Block sign-in until email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        code:    "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before signing in. Check your inbox for the verification link.",
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

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Always returns 200 — never reveals whether the email exists (anti-enumeration).
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    const genericOk = {
      message: "If an account with that email exists, we've sent a password reset link.",
    };

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Silently skip: no account, unverified account, or Google-only account
    if (!user || !user.emailVerified || !user.password) {
      return res.status(200).json(genericOk);
    }

    const { plain: plainToken, hashed: hashedToken } = generateToken();
    user.passwordResetToken  = hashedToken;
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Respond immediately, send email non-blocking
    res.status(200).json(genericOk);

    sendPasswordResetEmail(email, plainToken).catch((err) =>
      console.error("[forgotPassword] Failed to send reset email:", err.message)
    );

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

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user        = await User.findOne({ passwordResetToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        code:    "INVALID_RESET_TOKEN",
        message: "This password reset link is invalid or has already been used.",
      });
    }

    if (user.passwordResetExpiry < new Date()) {
      return res.status(400).json({
        code:    "RESET_TOKEN_EXPIRED",
        message: "This password reset link has expired. Please request a new one.",
      });
    }

    user.password            = await bcrypt.hash(password, 10);
    user.passwordResetToken  = null;
    user.passwordResetExpiry = null;
    await user.save();

    return res.status(200).json({
      code:    "PASSWORD_RESET_SUCCESS",
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
// Google users skip email verification — Google already verified the address.
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

      // Google already verified this email address
      user = await User.create({
        name:          name || email.split("@")[0],
        email,
        password:      null,
        googleId,
        avatar:        picture || "",
        emailVerified: true,
      });
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
