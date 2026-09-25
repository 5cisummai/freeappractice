import type { PageServerLoad } from './$types';
import {
	listOrganizationActivity,
	listOrganizationLeaderboard,
	listOrganizationSharedSets
} from '$lib/auth/organization-queries.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { authorizeFeatureRequest, getPlanAccessForRequest } from '$lib/super/feature-access.server';
import { getCurrentStudyPlan } from '$lib/super/study-plan.server';
import { timezoneFromCookies } from '$lib/users/timezone';

export const load: PageServerLoad = async ({ cookies, locals, parent }) => {
	const userId = locals.userId!;
	const parentPromise = parent();
	const dashboardPromise = loadUserDashboardData(userId, cookies);
	const planAccessPromise = getPlanAccessForRequest(locals, userId);
	const studyPlanAccessPromise = authorizeFeatureRequest({ locals }, userId, 'studyPlans');
	const studyPlanPromise = studyPlanAccessPromise.then((access) =>
		access.allowed ? getCurrentStudyPlan(userId) : Promise.resolve(null)
	);
	let activeOrganization: Awaited<ReturnType<typeof parent>>['activeOrganization'];
	try {
		({ activeOrganization } = await parentPromise);
	} catch (error) {
		await Promise.allSettled([
			dashboardPromise,
			planAccessPromise,
			studyPlanAccessPromise,
			studyPlanPromise
		]);
		throw error;
	}
	const showOrgFeatures = activeOrganization?.orgType === 'group';
	const timeZone = timezoneFromCookies(cookies);
	const [dashboard, planAccess, studyPlanAccess, studyPlan, orgActivity, orgSharedSets, orgLeaderboard] =
		await Promise.all([
		dashboardPromise,
		planAccessPromise,
		studyPlanAccessPromise,
		studyPlanPromise,
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
		studyPlan: studyPlanAccess.allowed ? studyPlan : null,
		canViewStudyPlan: studyPlanAccess.allowed,
		orgActivity,
		orgSharedSets,
		orgLeaderboard
	};
};
