import type { PageServerLoad } from './$types';
import { listOrganizationActivity } from '$lib/auth/organization-queries.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getPlanAccessForRequest } from '$lib/super/feature-access.server';

export const load: PageServerLoad = async ({ cookies, locals, parent }) => {
	const { activeOrganization } = await parent();
	const userId = locals.userId!;
	const showOrgActivity = activeOrganization?.orgType === 'group';
	const [dashboard, planAccess, orgActivity] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getPlanAccessForRequest(locals, userId),
		showOrgActivity && activeOrganization
			? listOrganizationActivity(activeOrganization.id)
			: Promise.resolve([])
	]);
	return {
		...dashboard,
		planAccess,
		orgActivity
	};
};
