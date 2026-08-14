import { generateText, hasToolCall, tool } from 'ai';
import { INSIGHTS_MODEL } from '$lib/ai/ai-models-config';
import { openaiModel } from '$lib/ai/service.server';
import { isSuperInsightsEnabled } from '$lib/flags';
import { logger } from '$lib/server/logger';
import { acquireInsightLock, RedisRequiredError, releaseLock } from '$lib/super/ai-controls.server';
import { getPlanAccess } from '$lib/super/billing.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { hasPaidCapability } from '$lib/super/types';
import {
	attachInsightReportPdf,
	buildAndStoreInsightReport,
	buildInsightReportData,
	getCurrentStoredInsightReport,
	getScoredAttemptsForUser,
	type InsightReportData,
	type InsightReportView
} from '$lib/super/insights.server';
import {
	insightPdfDocumentSchema,
	renderInsightPdf,
	type InsightPdfDocument
} from '$lib/super/insight-pdf.server';

export const INSIGHT_WEEKLY_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function isWeeklyInsightRefreshDue(
	report: Pick<InsightReportView, 'generatedAt'> | null,
	now = new Date()
): boolean {
	return (
		!report || new Date(report.generatedAt).getTime() <= now.getTime() - INSIGHT_WEEKLY_REFRESH_MS
	);
}

function metricForPrompt(
	metric: {
		weightedAveragePercentage: number;
		count: number;
		recentCount: number;
		trend: { direction: string; deltaPercentagePoints: number | null };
	} | null
) {
	if (!metric) return null;
	return {
		weightedAveragePercentage: metric.weightedAveragePercentage,
		count: metric.count,
		recentCount: metric.recentCount,
		trend: metric.trend
	};
}

function promptPayload(report: InsightReportData) {
	return {
		calculation: report.calculation,
		eligibility: report.eligibility,
		strengths: report.strengths.slice(0, 5).map((claim) => ({
			apClass: claim.apClass,
			unit: claim.unit,
			source: claim.source,
			metric: metricForPrompt(claim.metric)
		})),
		weaknesses: report.weaknesses.slice(0, 5).map((claim) => ({
			apClass: claim.apClass,
			unit: claim.unit,
			source: claim.source,
			metric: metricForPrompt(claim.metric)
		})),
		actionableInsights: report.actionableInsights,
		courses: report.courses.map((course) => ({
			apClass: course.apClass,
			totalScoredAttempts: course.totalScoredAttempts,
			metrics: {
				mcq: metricForPrompt(course.metrics.mcq ?? null),
				frq: metricForPrompt(course.metrics.frq ?? null)
			},
			units: course.units.map((unit) => ({
				unit: unit.unit,
				totalScoredAttempts: unit.totalScoredAttempts,
				metrics: {
					mcq: metricForPrompt(unit.metrics.mcq ?? null),
					frq: metricForPrompt(unit.metrics.frq ?? null)
				}
			}))
		}))
	};
}

/**
 * Lets the model author the report brief, then forces it to call the PDF tool.
 * The tool receives the model's prose but renders the exact calculated metrics from `report`.
 */
export async function createInsightPdfArtifact(
	report: InsightReportData
): Promise<{ pdfData: Uint8Array; narrative: string } | null> {
	if (!report.eligibility.eligible) return null;

	let pdfData: Uint8Array | null = null;
	let generatedDocument: InsightPdfDocument | null = null;

	await generateText({
		model: openaiModel(INSIGHTS_MODEL),
		system:
			'You are an AP study analyst. Read the calculated evidence and author a concise, encouraging PDF report brief. Do not predict an AP score, invent facts, blend MCQ with FRQ, or claim causality. Preserve the exact course and unit names. You must call generateInsightPdf exactly once after authoring the brief.',
		prompt: JSON.stringify(promptPayload(report)),
		tools: {
			generateInsightPdf: tool({
				description:
					'Generate the final student-facing PDF from this report brief. The server will render exact scores and evidence tables separately.',
				inputSchema: insightPdfDocumentSchema,
				execute: async (document) => {
					generatedDocument = document;
					pdfData = await renderInsightPdf(report, document);
					return { generated: true, format: 'pdf' };
				}
			})
		},
		toolChoice: { type: 'tool', toolName: 'generateInsightPdf' },
		stopWhen: hasToolCall('generateInsightPdf'),
		maxOutputTokens: 1_800
	});

	const finalDocument = generatedDocument;
	if (!pdfData || !finalDocument)
		throw new Error('The PDF report tool did not generate a document');
	return {
		pdfData: pdfData as Uint8Array,
		narrative: (finalDocument as InsightPdfDocument).executiveSummary
	};
}

/** Generate and attach a PDF to older report snapshots created before PDF reports existed. */
export async function ensureInsightPdf(
	userId: string,
	report: InsightReportView
): Promise<InsightReportView> {
	if (report.pdfAvailable) return report;
	const artifact = await createInsightPdfArtifact(report.report);
	if (!artifact) return report;
	return (
		(await attachInsightReportPdf(userId, report.id, artifact.pdfData, artifact.narrative)) ??
		report
	);
}

/**
 * Builds an AI-authored PDF at most once per week, only after evidence eligibility. A Redis
 * failure never hides an already-stored report; it merely skips this optional lazy refresh.
 */
export async function getOrBuildWeeklyInsightReport(
	userId: string,
	now = new Date()
): Promise<InsightReportView | null> {
	if (!(await isSuperInsightsEnabled())) return null;
	if (!hasPaidCapability(await getPlanAccess(userId, now), 'aiInsights')) return null;
	if (!(await getTutorProfileView(userId)).ageConfirmedAt) return null;
	const current = await getCurrentStoredInsightReport(userId, now);
	if (!isWeeklyInsightRefreshDue(current, now) && current?.pdfAvailable) return current;

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
		if (!isWeeklyInsightRefreshDue(refreshedCurrent, now)) {
			return refreshedCurrent ? await ensureInsightPdf(userId, refreshedCurrent) : refreshedCurrent;
		}
		const calculated = buildInsightReportData(await getScoredAttemptsForUser(userId), { now });
		if (!calculated.eligibility.eligible) return refreshedCurrent;
		const artifact = await createInsightPdfArtifact(calculated);
		if (!artifact) return refreshedCurrent;
		return await buildAndStoreInsightReport(userId, {
			now,
			manual: false,
			narrative: artifact.narrative,
			pdfData: artifact.pdfData
		});
	} catch (error) {
		logger.warn('Lazy Super insight refresh failed', { resource: 'weekly_insight', error });
		return current;
	} finally {
		await releaseLock(lock);
	}
}
