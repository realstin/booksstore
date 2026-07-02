const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.log('Database connection failed:', error);
    process.exit(1); // stop app if DB fails
  }
};

module.exports = connectDB;