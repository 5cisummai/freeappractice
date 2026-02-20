const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || "");
resend.domains.create({ name: 'freeappractice.org'});

const FROM = process.env.RESEND_FROM || "Free AP Practice <noreply@freeappractice.org>";

function getBaseUrl() {
  // If NODE_ENV is exactly "development" → localhost
  return process.env.NODE_ENV === "production"
    ? "https://www.freeappractice.org"
    : "http://localhost:3000";
}

/**
 * Send account confirmation email
 */
async function sendConfirmationEmail(email, token) {
  const link = `${getBaseUrl()}/auth/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Confirm your Free AP Practice account",
    html: `
      <h2>Welcome to Free AP Practice 👋</h2>
      <p>Please confirm your email to activate your account.</p>
      <a href="${link}">Confirm Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

/**
 * Send password reset email
 */
async function sendResetEmail(email, token) {
  const link = `${getBaseUrl()}/auth/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Free AP Practice password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password.</p>
      <a href="${link}">Reset Password</a>
      <p>This link expires in 15 minutes.</p>
      <p>If you didn’t request this, you can safely ignore this email.</p>
    `,
  });
}

module.exports = {
  sendConfirmationEmail,
  sendResetEmail
};
