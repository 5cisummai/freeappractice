import type { PageServerLoad } from './$types';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getInsightEligibilityForUser } from '$lib/super/insights.server';
import { buildStudyPlanDraft, getCurrentStudyPlan } from '$lib/super/study-plan.server';
import { getRecentStudyPlanAudits } from '$lib/super/study-plan-audit.server';
import { getOrBuildWeeklyInsightReport } from '$lib/super/insight-lifecycle.server';
import { getTutorProfileView } from '$lib/super/profile.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [entitlements, profile] = await Promise.all([
		getEntitlements(userId),
		getTutorProfileView(userId)
	]);
	const report =
		entitlements.aiInsights && profile.ageConfirmedAt
			? await getOrBuildWeeklyInsightReport(userId)
			: null;
	return {
		entitlements,
		profile,
		insightsEnabled: await isSuperInsightsEnabled(),
		eligibility:
			entitlements.aiInsights && profile.ageConfirmedAt
				? await getInsightEligibilityForUser(userId)
				: null,
		report,
		proposal: report?.report.eligibility.eligible ? buildStudyPlanDraft(report.report) : null,
		plan:
			entitlements.studyPlans && profile.ageConfirmedAt ? await getCurrentStudyPlan(userId) : null,
		planAudits:
			entitlements.studyPlans && profile.ageConfirmedAt
				? await getRecentStudyPlanAudits(userId)
				: []
	};
};
