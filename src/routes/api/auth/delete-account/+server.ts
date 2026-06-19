import { json } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { withAuthedHandler } from '$lib/server/route-helpers';

export const DELETE = withAuthedHandler(
	async (_event, userId) => {
		await connectDb();

		const deleted = await User.findByIdAndDelete(userId);
		if (!deleted) return json({ error: 'User not found' }, { status: 404 });

		return json({ message: 'Account deleted successfully' });
	},
	{ logLabel: 'Delete account error', errorMessage: 'Failed to delete account' }
);
