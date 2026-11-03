import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest, getPlanAccessForRequest } from '#lib/agent/access.server.js';
import { getCurrentStudyPlan } from '#lib/agent/plans/store.server.js';
import { buildStudyPlanPreview, toStudyPlanMobileView } from '#lib/agent/plans/mobile.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import {
	buildHomeCourseCards,
	buildSelectedCourseEntries,
	recommendHomeCourse,
	SUBJECT_PROGRESS_GOAL
} from '#lib/users/home-dashboard.server.js';
import { resolveApiPracticeContext } from '#lib/users/practice-context.server.js';
import { timezoneFromRequest } from '#lib/users/timezone.js';

/**
 * Consolidated Home payload for the native app.
 *
 * Pass `practiceNamespace=personal` to force personal practice data regardless
 * of the session's active school organization.
 */
export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveApiPracticeContext(event, userId);
		const timeZone = timezoneFromRequest(event.request, event.cookies);

		const dashboardPromise = loadUserDashboardData(userId, event.cookies, context, timeZone);
		const planAccessPromise = getPlanAccessForRequest(event.locals, userId);
		const studyPlanAccessPromise = authorizeFeatureRequest(event, userId, 'studyPlans');
		const studyPlanPromise = studyPlanAccessPromise.then((access) =>
			access.allowed ? getCurrentStudyPlan(userId) : Promise.resolve(null)
		);

		const [dashboard, planAccess, studyPlanAccess, studyPlan] = await Promise.all([
			dashboardPromise,
			planAccessPromise,
			studyPlanAccessPromise,
			studyPlanPromise
		]);

		const selectedCourses = buildSelectedCourseEntries(dashboard.selectedCourses);
		const courses = buildHomeCourseCards(
			dashboard.selectedCourses,
			dashboard.stats,
			dashboard.progress
		);
		const recommendation = recommendHomeCourse(courses);
		const mobilePlan =
			studyPlanAccess.allowed && studyPlan ? toStudyPlanMobileView(studyPlan) : null;

		return Response.json({
			practiceContext: {
				organizationId: context.organizationId,
				namespace: context.organizationId ? 'classroom' : 'personal'
			},
			selectedCourses,
			courses,
			progressGoal: SUBJECT_PROGRESS_GOAL,
			recommendation,
			stats: dashboard.stats,
			progress: dashboard.progress,
			frqEnabled: dashboard.frqEnabled,
			planAccess,
			studyPlan: {
				canView: studyPlanAccess.allowed,
				access: studyPlanAccess.allowed
					? { allowed: true as const }
					: {
							allowed: false as const,
							code: studyPlanAccess.code,
							message: studyPlanAccess.message,
							status: studyPlanAccess.status
						},
				plan: mobilePlan,
				preview: studyPlanAccess.allowed ? buildStudyPlanPreview(mobilePlan) : null
			}
		});
	},
	{ logLabel: 'Home dashboard error', errorMessage: 'Failed to load home dashboard' }
);
