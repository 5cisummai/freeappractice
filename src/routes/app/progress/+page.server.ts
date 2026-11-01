import type { PageServerLoad } from './$types';
import { historyFromParam, MAX_HISTORY_DAYS } from '#lib/components/progress/progress-metrics.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { getProgressHistory } from '#lib/users/history.server.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';
import { resolvePracticeContext } from '#lib/users/practice-context.server.js';

export const load: PageServerLoad = async ({ cookies, locals, parent }) => {
	const userId = locals.userId!;
	const { activeOrganization } = await parent();
	const context = await resolvePracticeContext(userId, activeOrganization?.id);
	const dashboard = await loadUserDashboardData(userId, cookies, context);
	try {
		const historyItems = await getProgressHistory(
			userId,
			{
				from: historyFromParam(MAX_HISTORY_DAYS, timezoneFromCookies(cookies)),
				includeFrq: dashboard.frqEnabled
			},
			context
		);
		return { ...dashboard, historyItems, historyError: false };
	} catch {
		return { ...dashboard, historyItems: [], historyError: true };
	}
};
