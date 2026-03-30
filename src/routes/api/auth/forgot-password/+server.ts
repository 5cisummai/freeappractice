import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { sendResetEmail } from '$lib/server/services/email';
import { generateRandomToken } from '$lib/server/crypto-token';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email } = await request.json();
		if (!email || typeof email !== 'string') {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findOne({ email: { $eq: email.toLowerCase().trim() } });

		// Always respond success to prevent email enumeration
		if (!user) {
			return json({ message: 'If that email exists, a reset link has been sent' });
		}

		const resetToken = generateRandomToken();
		const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

		user.resetPasswordToken = resetToken;
		user.resetPasswordExpires = resetExpires;
		await user.save();

		await sendResetEmail(user.email, resetToken);

		return json({ message: 'If that email exists, a reset link has been sent' });
	} catch (err) {
		console.error('Forgot password error:', err);
		return json({ error: 'Failed to send reset email' }, { status: 500 });
	}
};
