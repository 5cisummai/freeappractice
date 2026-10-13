import type { Cookies } from '@sveltejs/kit';
import { isFrqPracticeEnabled } from '#lib/flags.js';
import { getUserDashboardProfileOrFail } from '#lib/users/profile.server.js';
import { getDashboardProgress, getDashboardStats } from '#lib/users/dashboard-queries.server.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';

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
