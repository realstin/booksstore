const nodemailer = require('nodemailer');

// Create a transporter for Outlook email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  
    pass: process.env.EMAIL_PASS,  
  },
});

// Test the connection
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email service is ready to send messages');
  }
});

module.exports = transporter;