import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { signToken } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findOne({ email: { $eq: email.toLowerCase().trim() } }).select(
			'+password'
		);

		if (!user) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const token = signToken(user._id.toString());

		return json({
			token,
			user: { userId: user._id, name: user.name, email: user.email }
		});
	} catch (err) {
		logger.error('Login error', { error: err });
		return json({ error: 'Login failed' }, { status: 500 });
	}
};
