// Validate login input without applying signup password rules.
// Existing users must be able to authenticate with passwords created under older rules.

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

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

  if (password === undefined || password === null || password === '') {
    errors.push('Password is required.');
  } else if (typeof password !== 'string') {
    errors.push('Password must be a string.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = validateLoginInput;
