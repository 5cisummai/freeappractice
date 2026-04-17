import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '$env/static/private';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { signToken } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { idToken } = await request.json();

		if (!idToken || typeof idToken !== 'string') {
			return json({ error: 'ID token is required' }, { status: 400 });
		}

		// Verify the Google ID token
		let payload: { sub: string; email: string; name: string; email_verified: boolean };
		try {
			const ticket = await client.verifyIdToken({
				idToken,
				audience: GOOGLE_CLIENT_ID
			});
			const p = ticket.getPayload();
			if (!p || !p.sub || !p.email) {
				return json({ error: 'Invalid Google token' }, { status: 401 });
			}
			payload = {
				sub: p.sub,
				email: p.email,
				name: p.name ?? p.email.split('@')[0],
				email_verified: p.email_verified ?? false
			};
		} catch {
			return json({ error: 'Google token verification failed' }, { status: 401 });
		}

		await connectDb();

		// Find existing user by googleId or email
		let user = await User.findOne({
			$or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }]
		});

		if (user) {
			// If the user signed up with email/password, link their Google account
			if (!user.googleId) {
				user.googleId = payload.sub;
				user.authProvider = 'google';
				user.verified = true;
				await user.save();
			}
		} else {
			// Create a new Google-authenticated user (no password, auto-verified)
			user = new User({
				name: payload.name,
				email: payload.email.toLowerCase(),
				password: null,
				googleId: payload.sub,
				authProvider: 'google',
				verified: true
			});
			await user.save();
		}

		const token = signToken(user._id.toString());

		return json({
			token,
			user: { userId: user._id, name: user.name, email: user.email }
		});
	} catch (err) {
		logger.error('Google auth error', { error: err });
		return json({ error: 'Authentication failed' }, { status: 500 });
	}
};
