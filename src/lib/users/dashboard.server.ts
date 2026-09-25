import type { Cookies } from '@sveltejs/kit';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getUserDashboardProfileOrFail } from '$lib/users/profile.server';
import { getDashboardProgress, getDashboardStats } from '$lib/users/dashboard-queries.server';
import { timezoneFromCookies } from '$lib/users/timezone';

export async function loadUserDashboardData(userId: string, cookies: Cookies) {
	const [frqEnabled, user] = await Promise.all([
		isFrqPracticeEnabled(),
		getUserDashboardProfileOrFail(userId)
	]);

	const [stats, progress] = await Promise.all([
		getDashboardStats(userId, user.createdAt, timezoneFromCookies(cookies), frqEnabled),
		getDashboardProgress(userId, user.progress, frqEnabled)
	]);

	return {
		stats,
		progress,
		frqEnabled,
		selectedCourses: user.courses ?? []
	};
}
