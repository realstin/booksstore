const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

// Reusable Google OAuth2 client — only needs the client ID for token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ========== REGISTER FUNCTION ==========
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Please sign in instead."
      });
    }

    // 2. Hash the password (make it unreadable)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create new user in database
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 4. Never send the password hash back to the client
    const { password: _password, ...safeUser } = user.toObject();

    res.status(201).json({
      message: "User created successfully. Please login to continue.",
      user: safeUser
    });

  } catch (error) {
    next(error);
  }
};

// ========== LOGIN FUNCTION ==========
// User logs in with email and password, gets JWT token
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. CHECK IF USER EXISTS
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // 2. CHECK IF PASSWORD IS CORRECT
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // 3. CREATE JWT TOKEN
    // jwt.sign does: it assigns a jwt secret to user info and returns a token string 
    
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie("bookstowa_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // 4. SEND TOKEN TO USER
    // Remove password from response (never send it back)
    const { password: _password, ...safeUser } = user.toObject();

    res.status(200).json({
      message: "Login successful",
      user: safeUser
    });

  } catch (error) {
    next(error);
  }
};

// ========== LOGOUT FUNCTION ==========
// User logs out - clear the HTTP-only cookie
exports.logout = async (req, res, next) => {
  try {
    // Clear the HTTP-only cookie by using res.clearCookie()
    // This tells the browser to delete the cookie immediately
    // We must use the SAME cookie options (httpOnly, secure, sameSite) 
    // as we used when setting it in login
    res.clearCookie("bookstowa_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
    });

    res.status(200).json({
      message: "Logout successful. Token cleared."
    });

  } catch (error) {
    next(error);
  }
};
// ========== GET CURRENT USER ==========
// Fetch current logged-in user data from JWT token
exports.getMe = async (req, res, next) => {
  try {
    // req.user is set by authenticate middleware (from JWT)
    // It contains: userId, email, name from the token

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Never send password hash back to client
    const { password: _password, ...safeUser } = user.toObject();

    res.status(200).json({
      message: "User data retrieved successfully",
      user: safeUser
    });

  } catch (error) {
    next(error);
  }
};

// ========== GOOGLE AUTHENTICATION ==========
// POST /api/auth/google
// Frontend sends the Google credential (ID token) obtained from Google Sign-In.
// Backend verifies it with Google, then finds or creates a BookStore user,
// issues the existing bookstowa_token cookie, and returns safe user data.
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required."
      });
    }

    // ── 1. VERIFY THE ID TOKEN WITH GOOGLE ──────────────────────────────────
    // This makes a request to Google's servers and validates the token's
    // signature, expiry, and audience. We never trust the frontend's claims.
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
        message: "We couldn't verify your Google account. Please try again."
      });
    }

    // Extract the verified identity fields from Google's response
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        message: "Google account did not provide an email address."
      });
    }

    // ── 2. FIND OR CREATE THE BOOKSTORE USER ────────────────────────────────

    // First try to find by googleId (returning Google user)
    let user = await User.findOne({ googleId });

    if (!user) {
      // Not found by googleId — check if this email already has an account
      user = await User.findOne({ email });

      if (user) {
        // ── EMAIL CONFLICT ───────────────────────────────────────────────────
        // An email/password account exists with this email but has no Google
        // identity linked to it. We do NOT auto-link silently — the user must
        // explicitly sign in with their password. This prevents account takeover
        // via Google for accounts the user created with a password.
        return res.status(409).json({
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists. Please sign in with your email and password instead."
        });
      } else {
        // ── NEW USER ─────────────────────────────────────────────────────────
        // No account exists with this email. Create a new BookStore user.
        // password is null — Google users do not have a BookStore password.
        user = await User.create({
          name: name || email.split("@")[0],
          email,
          password: null,
          googleId,
          avatar: picture || "",
        });
      }
    }

    // ── 3. ISSUE THE EXISTING BOOKSTORE JWT ─────────────────────────────────
    // Same shape and settings as the email/password login — nothing changes
    // for the rest of the application. authenticate middleware works as-is.
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie("bookstowa_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // ── 4. RETURN SAFE USER DATA ─────────────────────────────────────────────
    const { password: _password, ...safeUser } = user.toObject();

    return res.status(200).json({
      message: "Google authentication successful",
      user: safeUser,
    });

  } catch (error) {
    next(error);
  }
};