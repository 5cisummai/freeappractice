import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';

export const DELETE: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const deleted = await User.findByIdAndDelete(userId);
		if (!deleted) return json({ error: 'User not found' }, { status: 404 });

		return json({ message: 'Account deleted successfully' });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Delete account error:', err);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};
