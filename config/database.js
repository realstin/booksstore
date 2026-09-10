const mongoose = require('mongoose');
const logger   = require('../utils/logger');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    // Fatal — the app cannot run without a database connection.
    // Log to stderr via pino then let process.exit(1) terminate cleanly.
    logger.fatal({ err: error }, 'Database connection failed');
    process.exit(1);
  }
};

module.exports = connectDB;