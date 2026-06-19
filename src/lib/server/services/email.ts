import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { getSiteUrl } from '$lib/site-url';

const resend = new Resend(RESEND_API_KEY);
const FROM = env.RESEND_FROM ?? 'Free AP Practice <auth@freeappractice.org>';

export async function sendConfirmationEmail(email: string, token: string): Promise<void> {
	const link = `${getSiteUrl()}/verify-email?token=${token}`;
	await resend.emails.send({
		from: FROM,
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

export async function sendResetEmail(email: string, token: string): Promise<void> {
	const link = `${getSiteUrl()}/reset-password?token=${token}`;
	await resend.emails.send({
		from: FROM,
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
