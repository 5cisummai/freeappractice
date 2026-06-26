import type { PageServerLoad } from './$types';
import { buildProgressData } from '$lib/users/progress.server';
import { buildStatsData } from '$lib/users/stats.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const user = await findUserProfileOrFail(userId, 'questionHistory progress createdAt');

	return {
		stats: buildStatsData(user),
		progress: buildProgressData(user)
	};
};
