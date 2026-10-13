import type { PageServerLoad } from './$types';
import { historyFromParam, MAX_HISTORY_DAYS } from '#lib/components/progress/progress-metrics.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { getProgressHistory } from '#lib/users/history.server.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const userId = locals.userId!;
	const dashboard = await loadUserDashboardData(userId, cookies);
	try {
		const historyItems = await getProgressHistory(userId, {
			from: historyFromParam(MAX_HISTORY_DAYS, timezoneFromCookies(cookies)),
			includeFrq: dashboard.frqEnabled
		});
		return { ...dashboard, historyItems, historyError: false };
	} catch {
		return { ...dashboard, historyItems: [], historyError: true };
	}
};
