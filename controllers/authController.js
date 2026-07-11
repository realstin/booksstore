const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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