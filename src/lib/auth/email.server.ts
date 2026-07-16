import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { getSiteUrl } from '$lib/auth/urls';
import { assertResendSent } from '$lib/auth/resend-result';

const resend = new Resend(RESEND_API_KEY);
const FROM = env.RESEND_FROM ?? 'Free AP Practice <auth@freeappractice.org>';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

async function sendEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
	const result = await resend.emails.send({
		from: FROM,
		to: payload.to,
		subject: payload.subject,
		html: payload.html
	});
	assertResendSent(result);
}

function resolveAuthLink(urlOrToken: string, path: '/verify-email' | '/reset-password'): string {
	if (urlOrToken.startsWith('http')) return urlOrToken;
	return `${getSiteUrl()}${path}?token=${encodeURIComponent(urlOrToken)}`;
}

/** Send verification email using Better Auth's full verification URL when provided. */
export async function sendConfirmationEmail(email: string, urlOrToken: string): Promise<void> {
	const link = resolveAuthLink(urlOrToken, '/verify-email');
	const safeLink = escapeHtml(link);
	await sendEmail({
		to: email,
		subject: 'Confirm your Free AP Practice account',
		html: `
      <h2>Welcome to Free AP Practice</h2>
      <p>Please confirm your email to activate your account.</p>
      <a href="${safeLink}">Confirm Email</a>
      <p>This link expires in 15 minutes.</p>
    `
	});
}

/** Send password reset email using Better Auth's full reset URL when provided. */
export async function sendResetEmail(email: string, urlOrToken: string): Promise<void> {
	const link = resolveAuthLink(urlOrToken, '/reset-password');
	const safeLink = escapeHtml(link);
	await sendEmail({
		to: email,
		subject: 'Reset your Free AP Practice password',
		html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password.</p>
      <a href="${safeLink}">Reset Password</a>
      <p>This link expires in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
	});
}

/** Ask the current email to approve a change before verifying the new address. */
export async function sendChangeEmailConfirmationEmail(
	currentEmail: string,
	newEmail: string,
	url: string
): Promise<void> {
	const safeLink = escapeHtml(url);
	const safeNewEmail = escapeHtml(newEmail);
	await sendEmail({
		to: currentEmail,
		subject: 'Approve email change on Free AP Practice',
		html: `
      <h2>Approve email change</h2>
      <p>Someone requested changing your Free AP Practice email to <strong>${safeNewEmail}</strong>.</p>
      <a href="${safeLink}">Approve email change</a>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
	});
}

/** Confirm account deletion via email (required for OAuth-only users). */
export async function sendDeleteAccountEmail(email: string, url: string): Promise<void> {
	const safeLink = escapeHtml(url);
	await sendEmail({
		to: email,
		subject: 'Confirm account deletion – Free AP Practice',
		html: `
      <h2>Confirm account deletion</h2>
      <p>Click the link below to permanently delete your Free AP Practice account and data.</p>
      <a href="${safeLink}">Delete my account</a>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
	});
}

/** Notify an existing user that someone tried to sign up with their email. */
export async function sendExistingUserSignupEmail(email: string): Promise<void> {
	const safeLogin = escapeHtml(`${getSiteUrl()}/login`);
	await sendEmail({
		to: email,
		subject: 'Sign-up attempt on your Free AP Practice account',
		html: `
      <h2>Sign-up attempt detected</h2>
      <p>Someone tried to create an account using your email address.</p>
      <p>If this was you, try <a href="${safeLogin}">signing in</a> instead.</p>
      <p>If not, you can safely ignore this email.</p>
    `
	});
}
