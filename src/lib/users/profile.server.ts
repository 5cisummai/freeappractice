import { json } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { UserProfile, type IUserProfile } from '$lib/users/model.server';

/** Create an empty app profile for a Better Auth user if one does not exist. */
export async function ensureUserProfile(userId: string): Promise<IUserProfile> {
	await connectDb();
	const existing = await UserProfile.findOne({ userId });
	if (existing) return existing;

	try {
		return await UserProfile.create({
			userId,
			progress: [],
			questionHistory: [],
			bookmarkedQuestions: []
		});
	} catch (err) {
		const profile = await UserProfile.findOne({ userId });
		if (profile) return profile;
		throw err;
	}
}

export async function findUserProfileOrFail(
	userId: string,
	select?: string
): Promise<IUserProfile> {
	await connectDb();

	let query = UserProfile.findOne({ userId });
	if (select) query = query.select(select);
	let profile = await query;
	if (profile) return profile;

	await ensureUserProfile(userId);

	query = UserProfile.findOne({ userId });
	if (select) query = query.select(select);
	profile = await query;
	if (!profile) {
		throw json({ error: 'User profile not found' }, { status: 404 });
	}
	return profile;
}
