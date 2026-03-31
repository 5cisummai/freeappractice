import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { sendConfirmationEmail } from '$lib/server/services/email';
import { generateRandomToken } from '$lib/server/crypto-token';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const { email } = await event.request.json();
		if (!email || typeof email !== 'string') {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		const normalizedEmail = email.toLowerCase().trim();

		await connectDb();

		const existingUser = await User.findOne({ email: { $eq: normalizedEmail } });
		if (existingUser) {
			return json({ error: 'Email already in use' }, { status: 409 });
		}

		const emailToken = generateRandomToken();
		const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

		await User.findByIdAndUpdate(userId, {
			email: normalizedEmail,
			verified: false,
			emailToken,
			emailTokenExpires
		});

		await sendConfirmationEmail(normalizedEmail, emailToken);

		return json({ message: 'Verification email sent to new address' });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Update email error:', err);
		return json({ error: 'Failed to update email' }, { status: 500 });
	}
};
