import type { PageServerLoad } from './$types';
import {
	listOrganizationActivity,
	listOrganizationLeaderboard,
	listOrganizationSharedSets
} from '#lib/auth/organization-queries.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { authorizeFeatureRequest, getPlanAccessForRequest } from '#lib/agent/access.server.js';
import { getCurrentStudyPlan } from '#lib/agent/plans/store.server.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';
import { resolvePracticeContext } from '#lib/users/practice-context.server.js';

export const load: PageServerLoad = async ({ cookies, locals, parent: getParent }) => {
	const userId = locals.userId!;
	const parentData = await getParent();
	const { activeOrganization } = parentData;
	const context = await resolvePracticeContext(userId, activeOrganization?.id);
	const dashboardPromise = loadUserDashboardData(userId, cookies, context);
	const planAccessPromise = getPlanAccessForRequest(locals, userId);
	const studyPlanAccessPromise = authorizeFeatureRequest({ locals }, userId, 'studyPlans');
	const studyPlanPromise = studyPlanAccessPromise.then((access) =>
		access.allowed ? getCurrentStudyPlan(userId) : Promise.resolve(null)
	);
	const showOrgFeatures = activeOrganization?.orgType === 'group';
	const timeZone = timezoneFromCookies(cookies);
	const [
		dashboard,
		planAccess,
		studyPlanAccess,
		studyPlan,
		orgActivity,
		orgSharedSets,
		orgLeaderboard
	] = await Promise.all([
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
