import type { PageServerLoad } from './$types';
import { getPersonalizedUsage, getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getCurrentStoredInsightReport } from '$lib/super/insights.server';
import { isWeeklyInsightRefreshDue } from '$lib/super/insight-lifecycle.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { getCurrentStudyPlan } from '$lib/super/study-plan.server';

type DashboardUsage =
	| { status: 'available'; used: number; remaining: number; warning: 80 | 95 | null }
	| { status: 'unavailable' }
	| { status: 'not_available' };

async function readDashboardUsage(userId: string, enabled: boolean): Promise<DashboardUsage> {
	if (!enabled) return { status: 'not_available' };
	try {
		const usage = await getPersonalizedUsage(userId);
		return {
			status: 'available',
			used: usage.used,
			remaining: usage.remaining,
			warning: getPersonalizedUsageWarning(usage)
		};
	} catch {
		return { status: 'unavailable' };
	}
}

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const userId = locals.userId!;
	const [dashboard, entitlements, profile] = await Promise.all([
		loadUserDashboardData(userId, cookies),
		getEntitlements(userId),
		getTutorProfileView(userId)
	]);
	const [superPlan, usage, insightReport] = await Promise.all([
		entitlements.studyPlans ? getCurrentStudyPlan(userId) : Promise.resolve(null),
		readDashboardUsage(userId, entitlements.personalizedTutor),
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
		superUsage: usage,
		superInsights: {
			status: insightsStatus,
			generatedAt: insightReport?.generatedAt ?? null
		}
	};
};
