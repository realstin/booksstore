const User = require("../models/User");
const bcrypt = require("bcrypt");
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create new user
    const user = await User.create({
   name,
   email,
   password: hashedPassword,
   });

    // 4. Never send the password hash back to the client
    const { password: _password, ...safeUser } = user.toObject();

    res.status(201).json({
      message: "User created successfully",
      user: safeUser
    });

  } catch (error) {
    // Pass to the shared errorHandler instead of handling it here —
    // it now knows how to turn Mongoose errors (validation, duplicate key)
    // into proper status codes instead of a blanket 500.
    next(error);
  }
};