import { isFrqPracticeEnabled } from '#lib/flags.js';
import { getUserDashboardProfileOrFail } from '#lib/users/profile.server.js';
import { getDashboardProgress, getDashboardStats } from '#lib/users/dashboard-queries.server.js';
import type { PracticeContext } from '#lib/users/practice-context.server.js';

export async function loadUserDashboardData(
	userId: string,
	timeZone: string | undefined,
	context: PracticeContext = { organizationId: null }
) {
	const [frqEnabled, user] = await Promise.all([
		isFrqPracticeEnabled(),
		getUserDashboardProfileOrFail(userId, context)
	]);

	const [stats, progress] = await Promise.all([
		getDashboardStats(userId, user.createdAt, timeZone, frqEnabled, context),
		getDashboardProgress(userId, user.progress, frqEnabled, context)
	]);

	return {
		stats,
		progress,
		frqEnabled,
		selectedCourses: user.courses ?? []
	};
}
