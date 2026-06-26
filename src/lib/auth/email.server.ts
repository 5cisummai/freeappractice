import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { getSiteUrl } from '$lib/auth/urls';

const resend = new Resend(RESEND_API_KEY);
const FROM = env.RESEND_FROM ?? 'Free AP Practice <auth@freeappractice.org>';

async function sendEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
	await resend.emails.send({
		from: FROM,
		to: payload.to,
		subject: payload.subject,
		html: payload.html
	});
}

/** Send verification email using Better Auth's full verification URL when provided. */
export async function sendConfirmationEmail(email: string, urlOrToken: string): Promise<void> {
	const link = urlOrToken.startsWith('http')
		? urlOrToken
		: `${getSiteUrl()}/verify-email?token=${encodeURIComponent(urlOrToken)}`;
	await sendEmail({
		to: email,
		subject: 'Confirm your Free AP Practice account',
		html: `
      <h2>Welcome to Free AP Practice 👋</h2>
      <p>Please confirm your email to activate your account.</p>
      <a href="${link}">Confirm Email</a>
      <p>This link expires in 24 hours.</p>
    `
	});
}

/** Send password reset email using Better Auth's full reset URL when provided. */
export async function sendResetEmail(email: string, urlOrToken: string): Promise<void> {
	const link = urlOrToken.startsWith('http')
		? urlOrToken
		: `${getSiteUrl()}/reset-password?token=${encodeURIComponent(urlOrToken)}`;
	await sendEmail({
		to: email,
		subject: 'Reset your Free AP Practice password',
		html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password.</p>
      <a href="${link}">Reset Password</a>
      <p>This link expires in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
	});
}

/** Notify an existing user that someone tried to sign up with their email. */
export async function sendExistingUserSignupEmail(email: string): Promise<void> {
	await sendEmail({
		to: email,
		subject: 'Sign-up attempt on your Free AP Practice account',
		html: `
      <h2>Sign-up attempt detected</h2>
      <p>Someone tried to create an account using your email address.</p>
      <p>If this was you, try <a href="${getSiteUrl()}/login">signing in</a> instead.</p>
      <p>If not, you can safely ignore this email.</p>
    `
	});
}
