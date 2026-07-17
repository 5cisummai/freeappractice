import type { PageServerLoad } from './$types';
import { loadUserDashboardData } from '$lib/users/dashboard.server';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	return loadUserDashboardData(locals.userId!, cookies);
};
