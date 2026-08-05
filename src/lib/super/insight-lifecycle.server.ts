import { generateText } from 'ai';
import { INSIGHTS_MODEL, openaiModel, requireExplicitSuperModel } from '$lib/ai/service.server';
import { logger } from '$lib/server/logger';
import { acquireInsightLock, RedisRequiredError, releaseLock } from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import {
	buildAndStoreInsightReport,
	buildInsightReportData,
	getCurrentStoredInsightReport,
	getScoredAttemptsForUser,
	type InsightReportData,
	type InsightReportView
} from '$lib/super/insights.server';

export const INSIGHT_WEEKLY_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function isWeeklyInsightRefreshDue(
	report: Pick<InsightReportView, 'generatedAt'> | null,
	now = new Date()
): boolean {
	return (
		!report || new Date(report.generatedAt).getTime() <= now.getTime() - INSIGHT_WEEKLY_REFRESH_MS
	);
}

export async function createInsightNarrative(report: InsightReportData): Promise<string | null> {
	requireExplicitSuperModel('INSIGHTS_MODEL');
	if (!report.eligibility.eligible) return null;
	const { text } = await generateText({
		model: openaiModel(INSIGHTS_MODEL),
		system:
			'Write a short, encouraging AP study insight from the supplied calculated aggregates. Do not predict an AP score, invent facts, mention hidden reasoning, or use more than 100 words.',
		prompt: JSON.stringify({
			evidence: report.eligibility,
			strengths: report.strengths.slice(0, 3),
			weaknesses: report.weaknesses.slice(0, 3),
			actions: report.actionableInsights.slice(0, 3)
		}),
		maxOutputTokens: 160
	});
	return text.trim().slice(0, 1_200) || null;
}

/**
 * Builds an AI narrative at most once per week, only after evidence eligibility. A Redis failure
 * never hides an already-stored report; it merely skips this optional lazy refresh.
 */
export async function getOrBuildWeeklyInsightReport(
	userId: string,
	now = new Date()
): Promise<InsightReportView | null> {
	if (!(await getEntitlements(userId, now)).aiInsights) return null;
	if (!(await getTutorProfileView(userId)).ageConfirmedAt) return null;
	const current = await getCurrentStoredInsightReport(userId, now);
	if (!isWeeklyInsightRefreshDue(current, now)) return current;

	let lock;
	try {
		lock = await acquireInsightLock(userId);
	} catch (error) {
		if (error instanceof RedisRequiredError) return current;
		throw error;
	}
	if (!lock) return current;

	try {
		const refreshedCurrent = await getCurrentStoredInsightReport(userId, now);
		if (!isWeeklyInsightRefreshDue(refreshedCurrent, now)) return refreshedCurrent;
		const calculated = buildInsightReportData(await getScoredAttemptsForUser(userId), { now });
		if (!calculated.eligibility.eligible) return refreshedCurrent;
		const narrative = await createInsightNarrative(calculated);
		return await buildAndStoreInsightReport(userId, { now, manual: false, narrative });
	} catch (error) {
		logger.warn('Lazy Super insight refresh failed', { userId, error });
		return current;
	} finally {
		await releaseLock(lock);
	}
}
