import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { signToken } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const token = url.searchParams.get('token');
		if (!token || typeof token !== 'string') {
			return json({ error: 'Verification token is required' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findOne({
			emailToken: { $eq: token },
			emailTokenExpires: { $gt: new Date() }
		});

		if (!user) {
			return json({ error: 'Invalid or expired verification token' }, { status: 400 });
		}

		user.verified = true;
		user.emailToken = null;
		user.emailTokenExpires = null;
		await user.save();

		const jwtToken = signToken(user._id.toString());

		return json({
			message: 'Email verified successfully. You are now logged in.',
			token: jwtToken,
			user: { userId: user._id, name: user.name, email: user.email }
		});
	} catch (err) {
		logger.error('Email verification error', { error: err });
		return json({ error: 'Email verification failed' }, { status: 500 });
	}
};
