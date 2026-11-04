import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { getCurrentStudyPlan } from '#lib/agent/plans/store.server.js';
import { buildStudyPlanPreview, toStudyPlanMobileView } from '#lib/agent/plans/mobile.js';

/**
 * Read the current study plan.
 *
 * Distinguishes entitlement denial (`canView: false`) from an entitled account
 * with no plan (`canView: true`, `plan: null`) and a plan with no tasks.
 */
export const GET = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'studyPlans');
		if (!access.allowed) {
			return Response.json(
				{
					canView: false,
					access: {
						allowed: false,
						code: access.code,
						message: access.message
					},
					plan: null,
					preview: null
				},
				{ status: access.status }
			);
		}

		const plan = await getCurrentStudyPlan(userId);
		const mobilePlan = plan ? toStudyPlanMobileView(plan) : null;
		return Response.json({
			canView: true,
			access: { allowed: true },
			plan: mobilePlan,
			preview: buildStudyPlanPreview(mobilePlan)
		});
	},
	{ logLabel: 'Get study plan error', errorMessage: 'Failed to load study plan' }
);
