import type { PageServerLoad } from './$types';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const userId = locals.userId!;
	const [dashboard, planAccess] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getPlanAccessForRequest(locals, userId)
	]);
	return {
		...dashboard,
		planAccess
	};
};
