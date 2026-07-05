// Middleware to validate user registration and login input

const validateUserInput = (req, res, next) => {
  const { name, email, password } = req.body;
  
  const errors = [];

  // ========== EMAIL VALIDATION ==========
  if (email === undefined || email === null || email === '') {
    errors.push('Email is required.');
  } else if (typeof email !== 'string') {
    errors.push('Email must be a string.');
  } else {
    // Check email format using regex (simple email pattern)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Email must be in valid format (example@email.com).');
    }
  }

  // ========== PASSWORD VALIDATION ==========
  if (password === undefined || password === null || password === '') {
    errors.push('Password is required.');
  } else if (typeof password !== 'string') {
    errors.push('Password must be a string.');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  // ========== NAME VALIDATION (only for registration) ==========
  // If name is provided, check it's valid
  // If name is not provided, that's okay (for login endpoint)
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') {
      errors.push('Name must be a string.');
    } else if (name.trim() === '') {
      errors.push('Name cannot be empty.');
    }
  }

  // ========== RESULT ==========
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = validateUserInput;