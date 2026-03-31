import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const user = await User.findById(userId).select(
			'-password -emailToken -emailTokenExpires -resetPasswordToken -resetPasswordExpires'
		);

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json({
			user: {
				userId: user._id,
				name: user.name,
				email: user.email,
				verified: user.verified
			}
		});
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Current user error:', err);
		return json({ error: 'Failed to get user' }, { status: 500 });
	}
};
