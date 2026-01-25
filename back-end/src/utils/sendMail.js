const nodemailer = require("nodemailer");
const logger = require("../logger/logger");

// Create transporter (Gmail example)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send email utility
 *
 * @param {string} template - mail type (otp, register, reset, etc.)
 * @param {string} toName
 * @param {string} subject
 * @param {string} content - OTP or message
 * @param {string} toEmail
 */
module.exports = async (template, toName, subject, content, toEmail) => {
  try {
    let html = "";

    // Basic templates (extend later)
    if (template === "otp") {
      html = `
        <p>Hello ${toName || "User"},</p>
        <p>Your OTP is:</p>
        <h2>${content}</h2>
        <p>This OTP is valid for 10 minutes.</p>
      `;
    } else {
      html = `<p>${content}</p>`;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || "HRMS <no-reply@hrms.com>",
      to: toEmail,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);

    logger.info("Email sent", {
      template,
      toEmail
    });

    return true;
  } catch (err) {
    logger.error("Failed to send email", {
      error: err.message,
      toEmail
    });

    // IMPORTANT: do not crash app because of email
    return false;
  }
};
