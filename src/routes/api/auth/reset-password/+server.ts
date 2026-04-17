import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { signToken } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { token, password } = await request.json();

		if (!token || !password) {
			return json({ error: 'Token and new password are required' }, { status: 400 });
		}

		if (password.length < 8) {
			return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findOne({
			resetPasswordToken: { $eq: token },
			resetPasswordExpires: { $gt: new Date() }
		}).select('+password');

		if (!user) {
			return json({ error: 'Invalid or expired reset token' }, { status: 400 });
		}

		const hash = await bcrypt.hash(password, 12);
		user.password = hash;
		user.resetPasswordToken = null;
		user.resetPasswordExpires = null;
		await user.save();

		const jwtToken = signToken(user._id.toString());

		return json({
			message: 'Password reset successfully',
			token: jwtToken,
			user: { userId: user._id, name: user.name, email: user.email }
		});
	} catch (err) {
		logger.error('Reset password error', { error: err });
		return json({ error: 'Password reset failed' }, { status: 500 });
	}
};
