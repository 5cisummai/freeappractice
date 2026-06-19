import { connectDb } from '$lib/server/db';
import { UserProfile, type IUserProfile } from '$lib/server/models/user-profile';

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
			frqHistory: [],
			bookmarkedQuestions: []
		});
	} catch (err) {
		// Another request may have created the profile concurrently.
		const profile = await UserProfile.findOne({ userId });
		if (profile) return profile;
		throw err;
	}
}
