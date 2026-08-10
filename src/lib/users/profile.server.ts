import { json } from '@sveltejs/kit';
import {
	createUserProfile,
	getUserDashboardProfile,
	type UserDashboardProfile
} from '$lib/users/model.server';

/** Create an empty app profile for a Better Auth user if one does not exist. */
export async function ensureUserProfile(userId: string): Promise<void> {
	await createUserProfile(userId);
}

export async function getUserDashboardProfileOrFail(userId: string): Promise<UserDashboardProfile> {
	let profile = await getUserDashboardProfile(userId);
	if (profile) return profile;
	await ensureUserProfile(userId);
	profile = await getUserDashboardProfile(userId);
	if (!profile) {
		throw json({ error: 'User profile not found' }, { status: 404 });
	}
	return profile;
}
