import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { buildProgressData } from '$lib/users/progress.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { getFrqProgressForUser } from '$lib/frq/attempts.server';
import { mergeFrqProgress } from '$lib/users/progress.server';
import { isFrqPracticeEnabled } from '$lib/flags';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'progress');
		if (!(await isFrqPracticeEnabled())) return json({ progress: buildProgressData(user) });
		return json({
			progress: mergeFrqProgress(buildProgressData(user), await getFrqProgressForUser(userId))
		});
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
