const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateVerificationCode, sendVerificationEmail } = require("../utils/emailService");

// ========== REGISTER FUNCTION ==========
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email"
      });
    }

    // 2. Hash the password (make it unreadable)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Generate verification code (6 digits)
    const verificationCode = generateVerificationCode();
    
    // 4. Set code expiration to 10 minutes from now
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // 5. Create new user in database (NOT VERIFIED YET)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      emailVerified: false,
      verificationCode,
      verificationCodeExpires,
    });

    // 6. Send verification email
    const emailResult = await sendVerificationEmail(email, name, verificationCode);

    if (!emailResult.success) {
      return res.status(500).json({
        message: "User created but failed to send verification email. Please try again.",
        error: emailResult.error
      });
    }

    // 7. Never send password hash or verification code back to the client
    const { password: _password, verificationCode: _code, ...safeUser } = user.toObject();

    res.status(201).json({
      message: "User created successfully. Check your email for verification code.",
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

    // 3. CHECK IF EMAIL IS VERIFIED ========== NEW ==========
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email first before logging in. Check your email for the verification code."
      });
    }

    // 4. CREATE JWT TOKEN
    // jwt.sign does:
    // - Takes data (user info)
    // - Signs it with JWT_SECRET (makes it secure)
    // - Returns a token string
    // - Token expires in 24 hours (86400 seconds = 24 hours)
    
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

    // 5. SEND TOKEN TO USER
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
// ========== VERIFY EMAIL FUNCTION ==========
// User submits their email and verification code to verify
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, verificationCode } = req.body;

    // 1. CHECK IF USER EXISTS
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found with this email"
      });
    }

    // 2. CHECK IF EMAIL IS ALREADY VERIFIED
    if (user.emailVerified) {
      return res.status(400).json({
        message: "This email is already verified"
      });
    }

    // 3. CHECK IF VERIFICATION CODE EXISTS
    if (!user.verificationCode) {
      return res.status(400).json({
        message: "No verification code found. Please register again."
      });
    }

    // 4. CHECK IF CODE HAS EXPIRED
    const now = new Date();
    if (now > user.verificationCodeExpires) {
      return res.status(400).json({
        message: "Verification code has expired. Please register again."
      });
    }

    // 5. CHECK IF CODE MATCHES
    if (user.verificationCode !== verificationCode) {
      return res.status(401).json({
        message: "Invalid verification code"
      });
    }

    // 6. MARK EMAIL AS VERIFIED AND CLEAR CODE
    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    // 7. SEND SUCCESS RESPONSE
    const { password: _password, verificationCode: _code, ...safeUser } = user.toObject();

    res.status(200).json({
      message: "Email verified successfully. You can now login.",
      user: safeUser
    });

  } catch (error) {
    next(error);
  }
};