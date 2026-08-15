import { json } from '@sveltejs/kit';
import {
	createUserProfile,
	getUserDashboardProfile,
	type UserDashboardProfile
} from '$lib/users/model.server';

export async function getUserDashboardProfileOrFail(userId: string): Promise<UserDashboardProfile> {
	let profile = await getUserDashboardProfile(userId);
	if (profile) return profile;
	await createUserProfile(userId);
	profile = await getUserDashboardProfile(userId);
	if (!profile) {
		throw json({ error: 'User profile not found' }, { status: 404 });
	}
	return profile;
}
