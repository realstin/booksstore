const transporter = require("../config/mail");

// ========== GENERATE 6-DIGIT CODE ==========
function generateVerificationCode() {
  // Generate random number between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========== SEND VERIFICATION EMAIL ==========
async function sendVerificationEmail(email, name, code) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,  // booksstowa@outlook.com
      to: email,                       // user's email
      subject: "Booksstore - Email Verification",
      html: `
        <h2>Welcome to Booksstore, ${name}!</h2>
        <p>Please verify your email address to complete your registration.</p>
        
        <h3>Your Verification Code:</h3>
        <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">
          ${code}
        </h1>
        
        <p><strong>This code expires in 10 minutes.</strong></p>
        
        <p>If you didn't create this account, please ignore this email.</p>
        
        <hr>
        <p style="color: #666; font-size: 12px;">
          © 2024 Booksstore. All rights reserved.
        </p>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Verification email sent" };

  } catch (error) {
    console.log("Email sending error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
};