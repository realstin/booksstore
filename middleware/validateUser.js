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
    const normalizedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 254) {
      errors.push('Email must not exceed 254 characters.');
    } else if (!emailRegex.test(normalizedEmail)) {
      errors.push('Email must be in valid format (example@email.com).');
    }
  }

  // ========== PASSWORD VALIDATION ==========
  if (password === undefined || password === null || password === '') {
    errors.push('Password is required.');
  } else if (typeof password !== 'string') {
    errors.push('Password must be a string.');
  } else {
    const passwordByteLength = Buffer.byteLength(password, 'utf8');
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const weakPasswords = new Set([
      '123456',
      '12345678',
      '123456789',
      '1234567890',
      'password',
      'password1',
      'password123',
      'qwerty',
      'qwerty123',
      'abcdef',
      'abcdefgh',
      'letmein',
      'welcome',
      'admin',
      'admin123'
    ]);

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }

    if (passwordByteLength > 72) {
      errors.push('Password must not exceed 72 bytes.');
    }

    if (!hasLetter) {
      errors.push('Password must contain at least one letter.');
    }

    if (!hasNumber) {
      errors.push('Password must contain at least one number.');
    }

    if (!hasSymbol) {
      errors.push('Password must contain at least one symbol.');
    }

    if (weakPasswords.has(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password.');
    }

    if (/^\d+$/.test(password)) {
      errors.push('Password cannot contain numbers only.');
    }

    if (/^(.)\1+$/.test(password)) {
      errors.push('Password cannot contain only one repeated character.');
    }
  }

  // ========== NAME VALIDATION (only for registration) ==========
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') {
      errors.push('Name must be a string.');
    } else {
      const normalizedName = name.trim();
      const nameRegex = /^[\p{L}\p{M} .'-]+$/u;

      if (normalizedName === '') {
        errors.push('Name cannot be empty.');
      } else if (normalizedName.length > 80) {
        errors.push('Name must not exceed 80 characters.');
      } else if (!nameRegex.test(normalizedName)) {
        errors.push('Name can only contain letters, spaces, hyphens, apostrophes, and periods.');
      } else if (normalizedName.split(/\s+/).length > 6) {
        errors.push('Name must not contain more than 6 words.');
      }
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
