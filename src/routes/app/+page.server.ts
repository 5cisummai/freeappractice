import type { PageServerLoad } from './$types';
import {
	listOrganizationActivity,
	listOrganizationLeaderboard,
	listOrganizationSharedSets
} from '$lib/auth/organization-queries.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getPlanAccessForRequest } from '$lib/super/feature-access.server';
import { timezoneFromCookies } from '$lib/users/timezone';

export const load: PageServerLoad = async ({ cookies, locals, parent }) => {
	const { activeOrganization } = await parent();
	const userId = locals.userId!;
	const showOrgFeatures = activeOrganization?.orgType === 'group';
	const timeZone = timezoneFromCookies(cookies);
	const [dashboard, planAccess, orgActivity, orgSharedSets, orgLeaderboard] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getPlanAccessForRequest(locals, userId),
		showOrgFeatures && activeOrganization
			? listOrganizationActivity(activeOrganization.id)
			: Promise.resolve([]),
		showOrgFeatures && activeOrganization
			? listOrganizationSharedSets(activeOrganization.id)
			: Promise.resolve([]),
		showOrgFeatures && activeOrganization
			? listOrganizationLeaderboard(activeOrganization.id, timeZone)
			: Promise.resolve([])
	]);
	return {
		...dashboard,
		planAccess,
		orgActivity,
		orgSharedSets,
		orgLeaderboard
	};
};
