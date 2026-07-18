import type { Cookies } from '@sveltejs/kit';
import { getFrqActivityForUser, getFrqProgressForUser } from '$lib/frq/attempts.server';
import { isFrqPracticeEnabled } from '$lib/flags';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { buildProgressData, mergeFrqProgress } from '$lib/users/progress.server';
import { buildStatsData } from '$lib/users/stats.server';
import { timezoneFromCookies } from '$lib/users/timezone';

export async function loadUserDashboardData(userId: string, cookies: Cookies) {
	const frqEnabled = await isFrqPracticeEnabled();
	const [user, frqProgress, frqActivity] = await Promise.all([
		findUserProfileOrFail(userId, 'questionHistory progress createdAt'),
		frqEnabled ? getFrqProgressForUser(userId) : Promise.resolve([]),
		frqEnabled ? getFrqActivityForUser(userId) : Promise.resolve([])
	]);

	return {
		stats: buildStatsData(user, timezoneFromCookies(cookies), frqActivity),
		progress: mergeFrqProgress(buildProgressData(user), frqProgress),
		frqEnabled
	};
}
