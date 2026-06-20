import type { PageServerLoad } from './$types';
import { buildProgressData, buildStatsData } from '$lib/server/dashboard-data';
import { findUserProfileOrFail } from '$lib/server/utils';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const user = await findUserProfileOrFail(userId, 'questionHistory progress createdAt');

	return {
		stats: buildStatsData(user),
		progress: buildProgressData(user)
	};
};
