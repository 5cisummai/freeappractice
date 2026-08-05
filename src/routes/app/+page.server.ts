import type { PageServerLoad } from './$types';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getCurrentStoredInsightReport } from '$lib/super/insights.server';
import { isWeeklyInsightRefreshDue } from '$lib/super/insight-lifecycle.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { getCurrentStudyPlan } from '$lib/super/study-plan.server';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const userId = locals.userId!;
	const [dashboard, entitlements, profile] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getEntitlements(userId),
		getTutorProfileView(userId)
	]);
	const [superPlan, insightReport] = await Promise.all([
		entitlements.studyPlans ? getCurrentStudyPlan(userId) : Promise.resolve(null),
		entitlements.aiInsights && profile.ageConfirmedAt
			? getCurrentStoredInsightReport(userId)
			: Promise.resolve(null)
	]);
	const insightsStatus = !entitlements.aiInsights
		? 'locked'
		: !profile.ageConfirmedAt
			? 'setup'
			: insightReport && !isWeeklyInsightRefreshDue(insightReport)
				? 'current'
				: 'due';

	return {
		...dashboard,
		entitlements,
		superPlan,
		superInsights: {
			status: insightsStatus,
			generatedAt: insightReport?.generatedAt ?? null
		}
	};
};
