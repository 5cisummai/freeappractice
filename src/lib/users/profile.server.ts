import {
	createUserProfile,
	getUserDashboardProfile,
	type UserDashboardProfile
} from '#lib/users/model.server.js';
import type { PracticeContext } from '#lib/users/practice-context.server.js';

export async function getUserDashboardProfileOrFail(
	userId: string,
	context: PracticeContext = { organizationId: null }
): Promise<UserDashboardProfile> {
	let profile = await getUserDashboardProfile(userId, context);
	if (profile) return profile;
	await createUserProfile(userId);
	profile = await getUserDashboardProfile(userId, context);
	if (!profile) {
		throw Response.json({ error: 'User profile not found' }, { status: 404 });
	}
	return profile;
}
