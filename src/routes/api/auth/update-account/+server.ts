import { json } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { sendConfirmationEmail } from '$lib/server/services/email';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findUserOrFail, generateEmailToken } from '$lib/server/utils';

export const PATCH = withAuthedHandler(
	async (event, userId) => {
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

		const user = await findUserOrFail(userId);

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
			await connectDb();
			const existing = await User.findOne({
				email: { $eq: email },
				_id: { $ne: userId }
			});
			if (existing) {
				return json({ error: 'Email already in use' }, { status: 409 });
			}

			const { emailToken, emailTokenExpires } = generateEmailToken();

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
	},
	{ logLabel: 'Update account error', errorMessage: 'Failed to update account' }
);
