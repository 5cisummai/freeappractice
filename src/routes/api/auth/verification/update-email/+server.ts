import { json } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { sendConfirmationEmail } from '$lib/server/services/email';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { generateEmailToken } from '$lib/server/utils';

export const POST = withAuthedHandler(
	async (event, userId) => {
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

		const { emailToken, emailTokenExpires } = generateEmailToken();

		await User.findByIdAndUpdate(userId, {
			email: normalizedEmail,
			verified: false,
			emailToken,
			emailTokenExpires
		});

		await sendConfirmationEmail(normalizedEmail, emailToken);

		return json({ message: 'Verification email sent to new address' });
	},
	{ logLabel: 'Update email error', errorMessage: 'Failed to update email' }
);
