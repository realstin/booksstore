const User       = require("../models/User");
const Subscriber = require("../models/Subscriber");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const logger     = require("../utils/logger");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Cookie options must be consistent between set and clear.
// - Production (HTTPS, cross-origin):  secure: true  + sameSite: "None"
// - Development (HTTP, same-origin):   secure: false + sameSite: "Lax"
//   Browsers reject sameSite:"None" cookies that are not Secure, so using
//   "Lax" in dev prevents the cookie from being silently dropped.
const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? "None" : "Lax",
  maxAge:   24 * 60 * 60 * 1000,
};

const issueAuthCookie = (res, user) => {
  // Only immutable, non-sensitive identifiers go into the token.
  // Everything else (name, email, avatar) is fetched fresh from the DB
  // on each request by the authenticate middleware, so it is always up-to-date.
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.cookie("bookstowa_token", token, cookieOptions);
};

const sanitizeUser = (userDoc) => {
  const { password: _pw, ...safe } = userDoc.toObject();
  return safe;
};

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register — creates account and logs in immediately
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
    const user = await User.create({ name, email, password: hashedPassword });

    // Auto-subscribe new user to newsletter
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
      logger.error({ err: subErr }, '[NEWSLETTER] Auto-subscribe failed (register)');
    }

    issueAuthCookie(res, user);

    return res.status(201).json({
      message: "Account created successfully. You are now logged in.",
      user:    sanitizeUser(user),
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
    // clearCookie must use the same options (secure, sameSite) that were used
    // when the cookie was set — otherwise the browser won't match and clear it.
    res.clearCookie("bookstowa_token", cookieOptions);
    return res.status(200).json({ message: "Logout successful. Token cleared." });
  } catch (error) {
    next(error);
  }
};

// ── GET CURRENT USER ──────────────────────────────────────────────────────────
// GET /api/auth/me
// authenticate already fetched the full user from the DB and attached it to
// req.user — no second round-trip needed here.
exports.getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      message: "User data retrieved successfully",
      user:    sanitizeUser(req.user),
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

      // Auto-subscribe new Google users to newsletter
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
        logger.info({ email: user.email }, '[NEWSLETTER] Auto-subscribed on Google register');
      } catch (subErr) {
        logger.error({ err: subErr, email: user.email }, '[NEWSLETTER] Auto-subscribe failed (google)');
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
