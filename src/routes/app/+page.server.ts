import type { PageServerLoad } from './$types';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getCurrentStudyPlan } from '$lib/super/study-plan.server';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const userId = locals.userId!;
	const [dashboard, entitlements] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getEntitlements(userId)
	]);
	return {
		...dashboard,
		entitlements,
		superPlan: entitlements.studyPlans ? await getCurrentStudyPlan(userId) : null
	};
};
