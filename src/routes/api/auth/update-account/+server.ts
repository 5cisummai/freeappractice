import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { generateRandomToken } from '$lib/server/crypto-token';
import { sendConfirmationEmail } from '$lib/server/services/email';
import { logger } from '$lib/server/logger';

export const PATCH: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = (await event.request.json().catch(() => null)) as {
			name?: unknown;
			email?: unknown;
		} | null;

		const name = typeof body?.name === 'string' ? body.name.trim() : '';
		const emailRaw = typeof body?.email === 'string' ? body.email : '';
		const email = emailRaw.toLowerCase().trim();

		if (!name) {
			return json({ error: 'Name is required' }, { status: 400 });
		}
		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findById(userId);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const emailChanged = user.email !== email;
		const nameChanged = user.name !== name;

		if (!emailChanged && !nameChanged) {
			return json({
				message: 'No changes to update',
				requiresVerification: false,
				user: { userId: user._id, name: user.name, email: user.email }
			});
		}

		user.name = name;

		if (emailChanged) {
			const existing = await User.findOne({
				email: { $eq: email },
				_id: { $ne: userId }
			});
			if (existing) {
				return json({ error: 'Email already in use' }, { status: 409 });
			}

			const emailToken = generateRandomToken();
			const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

			user.email = email;
			user.verified = false;
			user.emailToken = emailToken;
			user.emailTokenExpires = emailTokenExpires;

			await user.save();
			await sendConfirmationEmail(email, emailToken);

			return json({
				message: 'Account updated. Verification email sent to your new address.',
				requiresVerification: true,
				user: { userId: user._id, name: user.name, email: user.email }
			});
		}

		await user.save();

		return json({
			message: 'Account updated successfully',
			requiresVerification: false,
			user: { userId: user._id, name: user.name, email: user.email }
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Update account error', { error: err });
		return json({ error: 'Failed to update account' }, { status: 500 });
	}
};
