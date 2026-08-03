const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

// Reusable Google OAuth2 client — only needs the client ID for token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Generate a cryptographically secure random token and its SHA-256 hash.

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
// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates account and logs the user in immediately
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 4. Issue JWT cookie and log them in immediately
    issueAuthCookie(res, user);

    // 5. Return user data (safe - no password)
    const { password: _password, ...safeUser } = user.toObject();
    return res.status(201).json({
      message: "Account created successfully. You are now logged in.",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Standard email + password login. Blocked if email is not verified.
// ── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Standard email + password login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2. Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 3. Issue JWT cookie
    issueAuthCookie(res, user);

    // 4. Return user data (safe - no password)
    const { password: _password, ...safeUser } = user.toObject();
    return res.status(200).json({
      message: "Login successful",
      user: safeUser,
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
