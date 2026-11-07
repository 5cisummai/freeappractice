import type { PageServerLoad } from './$types';
import { getGroupOverview } from '#lib/auth/group-views.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { authorizeFeatureRequest, getPlanAccessForRequest } from '#lib/agent/access.server.js';
import { getCurrentStudyPlan } from '#lib/agent/plans/store.server.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';
import { resolvePracticeContext } from '#lib/users/practice-context.server.js';
import { formatDayInTimeZone } from '#lib/dates/calendar-day.js';

export const load: PageServerLoad = async ({ cookies, locals, parent: getParent }) => {
	const userId = locals.userId!;
	const parentData = await getParent();
	const { activeOrganization } = parentData;
	const context = await resolvePracticeContext(userId, activeOrganization?.id);
	const timeZone = timezoneFromCookies(cookies);
	const dashboardPromise = loadUserDashboardData(userId, timeZone, context);
	const planAccessPromise = getPlanAccessForRequest(locals, userId);
	const studyPlanAccessPromise = authorizeFeatureRequest({ locals }, userId, 'studyPlans');
	const studyPlanPromise = studyPlanAccessPromise.then((access) =>
		access.allowed ? getCurrentStudyPlan(userId) : Promise.resolve(null)
	);
	const showOrgFeatures = activeOrganization?.orgType === 'group';
	const [dashboard, planAccess, studyPlanAccess, studyPlan, groupOverview] = await Promise.all([
		dashboardPromise,
		planAccessPromise,
		studyPlanAccessPromise,
		studyPlanPromise,
		showOrgFeatures && activeOrganization
			? getGroupOverview(userId, activeOrganization.id, timeZone)
			: Promise.resolve({ orgActivity: [], orgSharedSets: [], orgLeaderboard: [] })
	]);
	return {
		...dashboard,
		today: formatDayInTimeZone(new Date(), timeZone),
		planAccess,
		studyPlan: studyPlanAccess.allowed ? studyPlan : null,
		canViewStudyPlan: studyPlanAccess.allowed,
		...groupOverview
	};
};
