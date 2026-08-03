const crypto = require("crypto");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendVerificationEmail } = require("../services/emailService");

// Reusable Google OAuth2 client — only needs the client ID for token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Generate a cryptographically secure random token and its SHA-256 hash.
// The raw token goes into the email URL; only the hash is stored in MongoDB.
const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

// Issue the BookStore JWT and set the HTTP-only cookie.
// Centralised here so register, login, and googleAuth all behave identically.
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
// Creates the account, sends a verification email, does NOT log the user in.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Reject duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Generate email verification token
    const { rawToken, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. Create user — emailVerified explicitly false, token hash stored
    await User.create({
      name,
      email,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
    });

    // 5. Send verification email
    // Build the URL the user will click — points to the backend verify endpoint.
    // The frontend will handle the redirect after verification if needed.
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
    await sendVerificationEmail(email, name, verificationUrl);

    // 6. Return — no JWT, no cookie, no session yet
    return res.status(201).json({
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Account created. Please check your email to verify your account.",
    });

  } catch (error) {
    next(error);
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Standard email + password login. Blocked if email is not verified.
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2. Verify password — do this BEFORE checking emailVerified so we don't
    //    reveal that the account exists via a different error path.
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 3. Block unverified accounts — only after password is confirmed correct
    if (!user.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in.",
      });
    }

    // 4. Issue JWT cookie and respond
    issueAuthCookie(res, user);

    const { password: _password, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "Login successful",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=<rawToken>
// Validates the token, marks the account verified, clears the token fields.
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        code: "INVALID_VERIFICATION_TOKEN",
        message: "Verification token is missing.",
      });
    }

    // Hash the supplied token and look it up — never query by raw token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({ emailVerificationTokenHash: tokenHash });

    if (!user) {
      return res.status(400).json({
        code: "INVALID_VERIFICATION_TOKEN",
        message: "Invalid verification link. Please request a new one.",
      });
    }

    // Already verified (token was cleared after first use)
    if (user.emailVerified) {
      return res.status(200).json({
        code: "EMAIL_ALREADY_VERIFIED",
        message: "Email is already verified. You can sign in.",
      });
    }

    // Check expiry
    if (user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({
        code: "VERIFICATION_TOKEN_EXPIRED",
        message: "This verification link has expired. Please request a new one.",
      });
    }

    // Mark verified and clear the token fields (single-use)
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    return res.status(200).json({
      code: "EMAIL_VERIFIED",
      message: "Email verified successfully. You can now sign in.",
    });

  } catch (error) {
    next(error);
  }
};

// ── RESEND VERIFICATION ───────────────────────────────────────────────────────
// POST /api/auth/resend-verification
// Generates a fresh token and resends the email.
// Enforces a 60-second cooldown to prevent abuse.
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });

    // Return the same response whether the user exists or not —
    // don't reveal account existence to unauthenticated callers.
    if (!user) {
      return res.status(200).json({
        message: "If an unverified account with that email exists, a new verification email has been sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        code: "EMAIL_ALREADY_VERIFIED",
        message: "This email is already verified. You can sign in.",
      });
    }

    // 60-second cooldown — check whether an unexpired token was issued recently
    if (
      user.emailVerificationExpiresAt &&
      user.emailVerificationExpiresAt > new Date() &&
      // token was issued less than 60 seconds ago
      user.emailVerificationExpiresAt > new Date(Date.now() + 24 * 60 * 60 * 1000 - 60 * 1000)
    ) {
      return res.status(429).json({
        message: "Please wait at least 60 seconds before requesting another verification email.",
      });
    }

    // Generate a fresh token
    const { rawToken, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = expiresAt;
    await user.save();

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
    await sendVerificationEmail(email, user.name, verificationUrl);

    return res.status(200).json({
      message: "If an unverified account with that email exists, a new verification email has been sent.",
    });

  } catch (error) {
    next(error);
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────────────────
// POST /api/auth/logout  — unchanged
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
// GET /api/auth/me  — unchanged
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password: _password, ...safeUser } = user.toObject();
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
    const { password: _password, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "Google authentication successful",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};
