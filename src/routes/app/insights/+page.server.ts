import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';
import { hasPaidCapability } from '$lib/super/types';
import { getInsightEligibilityForUser } from '$lib/super/insights.server';
import { buildStudyPlanDraft, getCurrentStudyPlan } from '$lib/super/study-plan.server';
import { getRecentStudyPlanAudits } from '$lib/super/study-plan-audit.server';
import { getOrBuildWeeklyInsightReport } from '$lib/super/insight-lifecycle.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import { getAssistantFeaturesEnabledForRequest } from '$lib/users/assistant-features.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	if (!(await getAssistantFeaturesEnabledForRequest(locals, userId))) {
		error(403, 'Assistant features are disabled for this account.');
	}
	const [planAccess, profile] = await Promise.all([
		getPlanAccessForRequest(locals, userId),
		getTutorProfileViewForRequest(locals, userId)
	]);
	const insightsEnabled = await isSuperInsightsEnabled();
	const hasInsightsAccess = hasPaidCapability(planAccess, 'aiInsights');
	const hasStudyPlanAccess = hasPaidCapability(planAccess, 'studyPlans');
	const report =
		insightsEnabled && hasInsightsAccess && profile.ageConfirmedAt
			? await getOrBuildWeeklyInsightReport(userId)
			: null;
	return {
		planAccess,
		hasInsightsAccess,
		profile,
		insightsEnabled,
		eligibility:
			insightsEnabled && hasInsightsAccess && profile.ageConfirmedAt
				? await getInsightEligibilityForUser(userId)
				: null,
		report,
		proposal: report?.report.eligibility.eligible ? buildStudyPlanDraft(report.report) : null,
		plan:
			insightsEnabled && hasStudyPlanAccess && profile.ageConfirmedAt
				? await getCurrentStudyPlan(userId)
				: null,
		planAudits:
			insightsEnabled && hasStudyPlanAccess && profile.ageConfirmedAt
				? await getRecentStudyPlanAudits(userId)
				: []
	};
};
