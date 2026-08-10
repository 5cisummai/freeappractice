import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { insightReports } from '$lib/server/neon/schema';
import { insightReportDataSchema } from '$lib/super/insight-schema';
import type { Entitlements } from '$lib/super/types';

export const INSIGHT_MIN_TOTAL_SCORED_ATTEMPTS = 20;
export const INSIGHT_MIN_CLAIM_ATTEMPTS = 5;
export const INSIGHT_RECENT_WINDOW_DAYS = 30;
export const INSIGHT_RECENT_MIN_ATTEMPTS = 5;
export const INSIGHT_RECENT_WEIGHT = 0.7;
export const INSIGHT_LIFETIME_WEIGHT = 0.3;
export const INSIGHT_TREND_MIN_ATTEMPTS = 5;
export const INSIGHT_TREND_STABLE_THRESHOLD = 3;
export const INSIGHT_SNAPSHOT_RETENTION_DAYS = 365;
export const INSIGHT_SNAPSHOT_MAX_PER_USER = 52;

const STRENGTH_THRESHOLD = 75;
const WEAKNESS_THRESHOLD = 60;

export type InsightSource = 'mcq' | 'frq';

export type InsightScoredAttempt = {
	/** Stable only for diagnostics; calculations treat every item as one attempt. */
	id?: string;
	source: InsightSource;
	apClass: string;
	unit: string;
	scorePercentage: number;
	/** Present for graded FRQs; MCQs derive their score from correctness instead. */
	rubricPointsEarned?: number;
	rubricPointsAvailable?: number;
	attemptedAt: Date | string;
};

export type InsightCalculationWindow = {
	name: 'lifetime' | 'last_30_days';
	count: number;
	averagePercentage: number | null;
};

export type InsightTrend = {
	direction: 'improving' | 'declining' | 'stable' | 'insufficient_data';
	deltaPercentagePoints: number | null;
	recentCount: number;
	priorCount: number;
	recentAveragePercentage: number | null;
	priorAveragePercentage: number | null;
};

export type InsightRubricPointWindow = {
	count: number;
	pointsEarned: number;
	pointsAvailable: number;
	percentage: number | null;
};

export type InsightRubricPointPerformance = {
	lifetime: InsightRubricPointWindow;
	last30Days: InsightRubricPointWindow;
};

export type InsightMetric = {
	source: InsightSource;
	count: number;
	recentCount: number;
	lifetimeAveragePercentage: number;
	recentAveragePercentage: number | null;
	weightedAveragePercentage: number;
	weighting: 'lifetime' | '70% recent / 30% lifetime';
	trend: InsightTrend;
	windows: {
		lifetime: InsightCalculationWindow;
		last30Days: InsightCalculationWindow;
	};
	rubricPointPerformance?: InsightRubricPointPerformance;
};

export type InsightClaim = {
	apClass: string;
	unit: string;
	source: InsightSource;
	metric: InsightMetric;
	classification: 'strength' | 'weakness' | 'mixed';
	practiceHref: string;
};

export type InsightUnit = {
	unit: string;
	totalScoredAttempts: number;
	metrics: Partial<Record<InsightSource, InsightMetric>>;
	strengths: InsightClaim[];
	weaknesses: InsightClaim[];
	actionableInsights: string[];
};

export type InsightCourse = {
	apClass: string;
	totalScoredAttempts: number;
	metrics: Partial<Record<InsightSource, InsightMetric>>;
	strengths: InsightClaim[];
	weaknesses: InsightClaim[];
	actionableInsights: string[];
	units: InsightUnit[];
};

export type InsightEligibility = {
	eligible: boolean;
	totalScoredAttempts: number;
	mcqScoredAttempts: number;
	frqScoredAttempts: number;
	minimumTotalAttempts: number;
	minimumAttemptsPerClaim: number;
	eligibleClaimCount: number;
	claimDefinition: 'source + course + unit';
	reason: 'eligible' | 'needs_more_total_attempts' | 'needs_more_attempts_in_a_claim';
};

export type InsightReportData = {
	schemaVersion: 1;
	generatedAt: string;
	narrative: null | string;
	calculation: {
		asOf: string;
		recentWindowDays: 30;
		recentMinimumAttempts: 5;
		recentWeight: 0.7;
		lifetimeWeight: 0.3;
		trendWindowDays: 30;
		trendMinimumAttempts: 5;
		trendStableThresholdPercentagePoints: 3;
		windowNames: ['lifetime', 'last_30_days'];
	};
	eligibility: InsightEligibility;
	strengths: InsightClaim[];
	weaknesses: InsightClaim[];
	actionableInsights: string[];
	courses: InsightCourse[];
};

export type InsightReportView = {
	id: string;
	userId: string;
	report: InsightReportData;
	evidenceAttemptCount: number;
	generatedAt: string;
	manual: boolean;
	pdfAvailable: boolean;
	feedback?: 'helpful' | 'not_helpful';
	feedbackReason?: string;
	lockedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export class SuperInsightsLockedError extends Error {
	constructor(message = 'Super Insights are unavailable without active access') {
		super(message);
		this.name = 'SuperInsightsLockedError';
	}
}

function roundPercentage(value: number): number {
	return Math.round(value * 100) / 100;
}

function asValidDate(value: Date | string | null | undefined): Date | null {
	const date = value instanceof Date ? new Date(value.getTime()) : value ? new Date(value) : null;
	return date && Number.isFinite(date.getTime()) ? date : null;
}

function isoDate(value: Date | string | null | undefined): string | null {
	return asValidDate(value)?.toISOString() ?? null;
}

function normalizeScore(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
}

function average(attempts: InsightScoredAttempt[]): number | null {
	if (!attempts.length) return null;
	return roundPercentage(
		attempts.reduce((sum, attempt) => sum + normalizeScore(attempt.scorePercentage), 0) /
			attempts.length
	);
}

function rubricPointWindow(attempts: InsightScoredAttempt[]): InsightRubricPointWindow {
	const scored = attempts.filter(
		(attempt) =>
			typeof attempt.rubricPointsEarned === 'number' &&
			Number.isFinite(attempt.rubricPointsEarned) &&
			typeof attempt.rubricPointsAvailable === 'number' &&
			Number.isFinite(attempt.rubricPointsAvailable) &&
			attempt.rubricPointsAvailable > 0
	);
	const pointsEarned = scored.reduce((sum, attempt) => sum + attempt.rubricPointsEarned!, 0);
	const pointsAvailable = scored.reduce((sum, attempt) => sum + attempt.rubricPointsAvailable!, 0);
	return {
		count: scored.length,
		pointsEarned: roundPercentage(pointsEarned),
		pointsAvailable: roundPercentage(pointsAvailable),
		percentage: pointsAvailable > 0 ? roundPercentage((pointsEarned / pointsAvailable) * 100) : null
	};
}

function makeTrend(
	attempts: InsightScoredAttempt[],
	now: Date,
	recentAttempts: InsightScoredAttempt[]
): InsightTrend {
	const recentCutoff = new Date(now.getTime() - INSIGHT_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const priorCutoff = new Date(
		recentCutoff.getTime() - INSIGHT_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
	);
	const priorAttempts = attempts.filter((attempt) => {
		const date = asValidDate(attempt.attemptedAt);
		return date !== null && date >= priorCutoff && date < recentCutoff;
	});
	const recentAverage = average(recentAttempts);
	const priorAverage = average(priorAttempts);
	if (
		recentAttempts.length < INSIGHT_TREND_MIN_ATTEMPTS ||
		priorAttempts.length < INSIGHT_TREND_MIN_ATTEMPTS ||
		recentAverage === null ||
		priorAverage === null
	) {
		return {
			direction: 'insufficient_data',
			deltaPercentagePoints: null,
			recentCount: recentAttempts.length,
			priorCount: priorAttempts.length,
			recentAveragePercentage: recentAverage,
			priorAveragePercentage: priorAverage
		};
	}

	const delta = roundPercentage(recentAverage - priorAverage);
	return {
		direction:
			delta >= INSIGHT_TREND_STABLE_THRESHOLD
				? 'improving'
				: delta <= -INSIGHT_TREND_STABLE_THRESHOLD
					? 'declining'
					: 'stable',
		deltaPercentagePoints: delta,
		recentCount: recentAttempts.length,
		priorCount: priorAttempts.length,
		recentAveragePercentage: recentAverage,
		priorAveragePercentage: priorAverage
	};
}

function classify(score: number): InsightClaim['classification'] {
	if (score >= STRENGTH_THRESHOLD) return 'strength';
	if (score < WEAKNESS_THRESHOLD) return 'weakness';
	return 'mixed';
}

function practiceHrefForClaim(source: InsightSource, apClass: string, unit: string): string {
	const params = new URLSearchParams({ apClass, unit });
	if (source === 'frq') params.set('mode', 'frq');
	return `/app/practice?${params.toString()}`;
}

function compareClaim(a: InsightClaim, b: InsightClaim): number {
	return (
		a.metric.weightedAveragePercentage - b.metric.weightedAveragePercentage ||
		b.metric.count - a.metric.count ||
		a.apClass.localeCompare(b.apClass) ||
		a.unit.localeCompare(b.unit) ||
		a.source.localeCompare(b.source)
	);
}

function compareSourceClaim(a: InsightClaim, b: InsightClaim): number {
	return a.source.localeCompare(b.source) || compareClaim(a, b);
}

function makeMetric(
	source: InsightSource,
	attempts: InsightScoredAttempt[],
	now: Date
): InsightMetric | null {
	if (attempts.length < INSIGHT_MIN_CLAIM_ATTEMPTS) return null;

	const cutoff = new Date(now.getTime() - INSIGHT_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const lifetime = attempts.filter((attempt) => {
		const date = asValidDate(attempt.attemptedAt);
		return date !== null && date <= now;
	});
	if (lifetime.length < INSIGHT_MIN_CLAIM_ATTEMPTS) return null;
	const recent = lifetime.filter((attempt) => {
		const date = asValidDate(attempt.attemptedAt);
		return date !== null && date >= cutoff;
	});
	const lifetimeAverage = average(lifetime) ?? 0;
	const recentAverage = average(recent);
	const useRecentWeighting = recent.length >= INSIGHT_RECENT_MIN_ATTEMPTS && recentAverage !== null;
	const rubricPointPerformance =
		source === 'frq'
			? {
					lifetime: rubricPointWindow(lifetime),
					last30Days: rubricPointWindow(recent)
				}
			: undefined;

	return {
		source,
		count: lifetime.length,
		recentCount: recent.length,
		lifetimeAveragePercentage: lifetimeAverage,
		recentAveragePercentage: recentAverage,
		weightedAveragePercentage: useRecentWeighting
			? roundPercentage(
					INSIGHT_RECENT_WEIGHT * recentAverage + INSIGHT_LIFETIME_WEIGHT * lifetimeAverage
				)
			: lifetimeAverage,
		weighting: useRecentWeighting ? '70% recent / 30% lifetime' : 'lifetime',
		trend: makeTrend(attempts, now, recent),
		windows: {
			lifetime: {
				name: 'lifetime',
				count: lifetime.length,
				averagePercentage: lifetimeAverage
			},
			last30Days: {
				name: 'last_30_days',
				count: recent.length,
				averagePercentage: recentAverage
			}
		},
		...(rubricPointPerformance ? { rubricPointPerformance } : {})
	};
}

function makeClaim(
	source: InsightSource,
	apClass: string,
	unit: string,
	attempts: InsightScoredAttempt[],
	now: Date
): InsightClaim | null {
	const metric = makeMetric(source, attempts, now);
	if (!metric) return null;
	return {
		apClass,
		unit,
		source,
		metric,
		classification: classify(metric.weightedAveragePercentage),
		practiceHref: practiceHrefForClaim(source, apClass, unit)
	};
}

function makeActionableInsight(claim: InsightClaim): string {
	const activity = claim.source === 'frq' ? 'a graded FRQ response' : 'MCQ retrieval practice';
	return `Prioritize ${claim.apClass} · ${claim.unit}: complete 25 minutes of ${activity}, then review the missed concepts.`;
}

function makeMaintenanceInsight(claim: InsightClaim): string {
	const activity = claim.source === 'frq' ? 'a short FRQ response' : 'a short MCQ set';
	return `Maintain ${claim.apClass} · ${claim.unit} with ${activity} during spaced review.`;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = keyFor(item);
		const group = groups.get(key);
		if (group) group.push(item);
		else groups.set(key, [item]);
	}
	return groups;
}

function buildEligibility(
	attempts: InsightScoredAttempt[],
	eligibleClaims: InsightClaim[]
): InsightEligibility {
	const mcqScoredAttempts = attempts.filter((attempt) => attempt.source === 'mcq').length;
	const frqScoredAttempts = attempts.filter((attempt) => attempt.source === 'frq').length;
	const totalScoredAttempts = attempts.length;
	const totalReady = totalScoredAttempts >= INSIGHT_MIN_TOTAL_SCORED_ATTEMPTS;
	const claimReady = eligibleClaims.length > 0;
	return {
		eligible: totalReady && claimReady,
		totalScoredAttempts,
		mcqScoredAttempts,
		frqScoredAttempts,
		minimumTotalAttempts: INSIGHT_MIN_TOTAL_SCORED_ATTEMPTS,
		minimumAttemptsPerClaim: INSIGHT_MIN_CLAIM_ATTEMPTS,
		eligibleClaimCount: eligibleClaims.length,
		claimDefinition: 'source + course + unit',
		reason: !totalReady
			? 'needs_more_total_attempts'
			: !claimReady
				? 'needs_more_attempts_in_a_claim'
				: 'eligible'
	};
}

/**
 * Build deterministic analytics from already-normalized scored attempts.
 * A claim is source + course + unit, so MCQ and FRQ scores never get blended.
 */
export function buildInsightReportData(
	input: InsightScoredAttempt[],
	options: { now?: Date; narrative?: string | null } = {}
): InsightReportData {
	const now = options.now ? new Date(options.now.getTime()) : new Date();
	const attempts = input
		.map((attempt) => ({
			...attempt,
			apClass: attempt.apClass.trim(),
			unit: attempt.unit.trim(),
			scorePercentage: normalizeScore(attempt.scorePercentage),
			attemptedAt: asValidDate(attempt.attemptedAt) ?? new Date(0)
		}))
		.filter(
			(attempt) =>
				attempt.apClass.length > 0 &&
				attempt.unit.length > 0 &&
				new Date(attempt.attemptedAt).getTime() <= now.getTime()
		);

	const claimGroups = groupBy(
		attempts,
		(attempt) => `${attempt.source}\u0000${attempt.apClass}\u0000${attempt.unit}`
	);
	const eligibleClaims: InsightClaim[] = [];
	for (const [key, group] of claimGroups) {
		const [source, apClass, unit] = key.split('\u0000') as [InsightSource, string, string];
		const claim = makeClaim(source, apClass, unit, group, now);
		if (claim) eligibleClaims.push(claim);
	}

	const courseGroups = groupBy(attempts, (attempt) => attempt.apClass);
	const courses: InsightCourse[] = [...courseGroups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([apClass, courseAttempts]) => {
			const metrics: Partial<Record<InsightSource, InsightMetric>> = {};
			const courseClaims: InsightClaim[] = [];
			for (const source of ['mcq', 'frq'] as const) {
				const sourceAttempts = courseAttempts.filter((attempt) => attempt.source === source);
				const metric = makeMetric(source, sourceAttempts, now);
				if (metric) {
					metrics[source] = metric;
					const claim = makeClaim(source, apClass, 'All units', sourceAttempts, now);
					if (claim) courseClaims.push(claim);
				}
			}

			const unitGroups = groupBy(courseAttempts, (attempt) => attempt.unit);
			const units: InsightUnit[] = [...unitGroups.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([unit, unitAttempts]) => {
					const unitMetrics: Partial<Record<InsightSource, InsightMetric>> = {};
					const unitClaims: InsightClaim[] = [];
					for (const source of ['mcq', 'frq'] as const) {
						const sourceAttempts = unitAttempts.filter((attempt) => attempt.source === source);
						const claim = makeClaim(source, apClass, unit, sourceAttempts, now);
						if (claim) {
							unitMetrics[source] = claim.metric;
							unitClaims.push(claim);
						}
					}
					const strengths = unitClaims
						.filter((claim) => claim.classification === 'strength')
						.sort(compareSourceClaim);
					const weaknesses = unitClaims
						.filter((claim) => claim.classification === 'weakness')
						.sort(compareSourceClaim);
					return {
						unit,
						totalScoredAttempts: unitAttempts.length,
						metrics: unitMetrics,
						strengths,
						weaknesses,
						actionableInsights: [
							...weaknesses.map(makeActionableInsight),
							...strengths.map(makeMaintenanceInsight)
						]
					};
				});

			const strengths = courseClaims
				.filter((claim) => claim.classification === 'strength')
				.sort(compareSourceClaim);
			const weaknesses = courseClaims
				.filter((claim) => claim.classification === 'weakness')
				.sort(compareSourceClaim);
			return {
				apClass,
				totalScoredAttempts: courseAttempts.length,
				metrics,
				strengths,
				weaknesses,
				actionableInsights: [
					...weaknesses.map(makeActionableInsight),
					...strengths.map(makeMaintenanceInsight)
				],
				units
			};
		});

	const strengths = eligibleClaims
		.filter((claim) => claim.classification === 'strength')
		.sort(compareClaim);
	const weaknesses = eligibleClaims
		.filter((claim) => claim.classification === 'weakness')
		.sort(compareClaim);
	const eligibility = buildEligibility(attempts, eligibleClaims);

	return {
		schemaVersion: 1,
		generatedAt: now.toISOString(),
		narrative: options.narrative ?? null,
		calculation: {
			asOf: now.toISOString(),
			recentWindowDays: 30,
			recentMinimumAttempts: 5,
			recentWeight: 0.7,
			lifetimeWeight: 0.3,
			trendWindowDays: INSIGHT_RECENT_WINDOW_DAYS,
			trendMinimumAttempts: INSIGHT_TREND_MIN_ATTEMPTS,
			trendStableThresholdPercentagePoints: INSIGHT_TREND_STABLE_THRESHOLD,
			windowNames: ['lifetime', 'last_30_days']
		},
		eligibility,
		strengths,
		weaknesses,
		actionableInsights: weaknesses.slice(0, 5).map(makeActionableInsight),
		courses
	};
}

/** Read only the scored evidence required by the pure report calculation. */
export async function getScoredAttemptsForUser(userId: string): Promise<InsightScoredAttempt[]> {
	const { getScoredAttemptsForUser: readEvidence } =
		await import('$lib/super/insight-evidence.server');
	return readEvidence(userId);
}

async function getInsightDatabase() {
	return getNeonDatabase();
}

async function getInsightEntitlements(userId: string, now?: Date) {
	const { getEntitlements } = await import('$lib/super/entitlements.server');
	return getEntitlements(userId, now);
}

async function getInsightTutorProfileView(userId: string) {
	const { getTutorProfileView } = await import('$lib/super/profile.server');
	return getTutorProfileView(userId);
}

export function hasInsightAccess(entitlements: Pick<Entitlements, 'aiInsights'>): boolean {
	return entitlements.aiInsights;
}

async function requireInsightAccess(userId: string, now = new Date()): Promise<void> {
	if (!(await isSuperInsightsEnabled())) throw new SuperInsightsLockedError();
	const entitlements = await getInsightEntitlements(userId, now);
	if (!hasInsightAccess(entitlements)) throw new SuperInsightsLockedError();
	if (!(await getInsightTutorProfileView(userId)).ageConfirmedAt)
		throw new SuperInsightsLockedError();
}

function reportFromStored(value: Record<string, unknown>): InsightReportData {
	return insightReportDataSchema.parse(value) as InsightReportData;
}

/** Convert a database report into a Date-free view safe for JSON serialization. */
export function toInsightReportView(report: {
	id: unknown;
	userId: string;
	report: Record<string, unknown>;
	evidenceAttemptCount: number;
	generatedAt: Date | string;
	manual: boolean;
	pdfData?: Buffer | null;
	pdfAvailable?: boolean;
	pdfGeneratedAt?: Date | string;
	pdfGenerationVersion?: number;
	feedback?: string | null;
	feedbackReason?: string | null;
	lockedAt?: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}): InsightReportView {
	const generatedAt = isoDate(report.generatedAt);
	const createdAt = isoDate(report.createdAt);
	const updatedAt = isoDate(report.updatedAt);
	if (!generatedAt || !createdAt || !updatedAt)
		throw new Error('Insight report has invalid timestamps');
	const feedback =
		report.feedback === 'helpful' || report.feedback === 'not_helpful'
			? report.feedback
			: undefined;
	return {
		id: String(report.id),
		userId: report.userId,
		report: reportFromStored(report.report),
		evidenceAttemptCount: report.evidenceAttemptCount,
		generatedAt,
		manual: report.manual,
		pdfAvailable: report.pdfAvailable ?? Boolean(report.pdfData && report.pdfData.length > 0),
		...(feedback ? { feedback } : {}),
		...(report.feedbackReason ? { feedbackReason: report.feedbackReason } : {}),
		lockedAt: isoDate(report.lockedAt),
		createdAt,
		updatedAt
	};
}

export async function attachInsightReportPdf(
	userId: string,
	reportId: string,
	pdfData: Uint8Array,
	narrative?: string | null
): Promise<InsightReportView | null> {
	const db = await getInsightDatabase();
	const now = new Date();
	const [updated] = await db
		.update(insightReports)
		.set({
			pdfData: Buffer.from(pdfData),
			pdfGeneratedAt: now,
			pdfGenerationVersion: 1,
			updatedAt: now,
			...(narrative
				? {
						report: sql<Record<string, unknown>>`jsonb_set(
							${insightReports.report},
							'{narrative}',
							to_jsonb(${narrative}::text),
							true
						)`
					}
				: {})
		})
		.where(and(eq(insightReports.id, reportId), eq(insightReports.userId, userId)))
		.returning({
			id: insightReports.id,
			userId: insightReports.userId,
			report: insightReports.report,
			evidenceAttemptCount: insightReports.evidenceAttemptCount,
			generatedAt: insightReports.generatedAt,
			manual: insightReports.manual,
			feedback: insightReports.feedback,
			feedbackReason: insightReports.feedbackReason,
			lockedAt: insightReports.lockedAt,
			createdAt: insightReports.createdAt,
			updatedAt: insightReports.updatedAt
		});
	return updated ? toInsightReportView({ ...updated, pdfAvailable: true }) : null;
}

export async function getStoredInsightReportPdf(userId: string): Promise<Buffer | null> {
	const db = await getInsightDatabase();
	const [report] = await db
		.select({ pdfData: insightReports.pdfData })
		.from(insightReports)
		.where(eq(insightReports.userId, userId))
		.orderBy(desc(insightReports.generatedAt), desc(insightReports.id))
		.limit(1);
	return report?.pdfData ? Buffer.from(report.pdfData) : null;
}

async function getReadableStoredReport(
	userId: string,
	now = new Date()
): Promise<InsightReportView | null> {
	await requireInsightAccess(userId, now);
	const pdfAvailable = sql<boolean>`coalesce(octet_length(${insightReports.pdfData}), 0) > 0`.as(
		'pdfAvailable'
	);
	const db = await getInsightDatabase();
	const [report] = await db
		.select({
			id: insightReports.id,
			userId: insightReports.userId,
			report: insightReports.report,
			evidenceAttemptCount: insightReports.evidenceAttemptCount,
			generatedAt: insightReports.generatedAt,
			manual: insightReports.manual,
			pdfAvailable,
			feedback: insightReports.feedback,
			feedbackReason: insightReports.feedbackReason,
			lockedAt: insightReports.lockedAt,
			createdAt: insightReports.createdAt,
			updatedAt: insightReports.updatedAt
		})
		.from(insightReports)
		.where(eq(insightReports.userId, userId))
		.orderBy(desc(insightReports.generatedAt), desc(insightReports.id))
		.limit(1);
	return report ? toInsightReportView(report) : null;
}

/** Returns the latest stored report while the user has current Super access. */
export async function getCurrentStoredInsightReport(
	userId: string,
	now = new Date()
): Promise<InsightReportView | null> {
	try {
		const entitlements = await getInsightEntitlements(userId, now);
		if (!hasInsightAccess(entitlements)) return null;
		return await getReadableStoredReport(userId, now);
	} catch (error) {
		if (error instanceof SuperInsightsLockedError) return null;
		throw error;
	}
}

export async function getInsightEligibilityForUser(
	userId: string,
	now = new Date()
): Promise<InsightEligibility> {
	const attempts = await getScoredAttemptsForUser(userId);
	return buildInsightReportData(attempts, { now }).eligibility;
}

/** Stored reports are current only when the user still has access and evidence eligibility. */
export async function getCurrentEligibleInsightReport(
	userId: string,
	now = new Date()
): Promise<InsightReportView | null> {
	const report = await getCurrentStoredInsightReport(userId, now);
	if (!report) return null;
	const eligibility = await getInsightEligibilityForUser(userId, now);
	if (!eligibility.eligible) return null;
	return report;
}

export async function buildAndStoreInsightReport(
	userId: string,
	options: {
		now?: Date;
		manual?: boolean;
		narrative?: string | null;
		pdfData?: Uint8Array;
	} = {}
): Promise<InsightReportView | null> {
	await requireInsightAccess(userId);
	const now = options.now ? new Date(options.now.getTime()) : new Date();
	const attempts = await getScoredAttemptsForUser(userId);
	const reportData = buildInsightReportData(attempts, {
		now,
		narrative: options.narrative
	});
	if (!reportData.eligibility.eligible) return null;

	const db = await getInsightDatabase();
	const [created] = await db
		.insert(insightReports)
		.values({
			id: randomUUID(),
			userId,
			report: reportData,
			evidenceAttemptCount: reportData.eligibility.totalScoredAttempts,
			generatedAt: now,
			manual: Boolean(options.manual),
			...(options.pdfData
				? {
						pdfData: Buffer.from(options.pdfData),
						pdfGeneratedAt: now,
						pdfGenerationVersion: 1
					}
				: {})
		})
		.returning({
			id: insightReports.id,
			userId: insightReports.userId,
			report: insightReports.report,
			evidenceAttemptCount: insightReports.evidenceAttemptCount,
			generatedAt: insightReports.generatedAt,
			manual: insightReports.manual,
			pdfData: insightReports.pdfData,
			feedback: insightReports.feedback,
			feedbackReason: insightReports.feedbackReason,
			lockedAt: insightReports.lockedAt,
			createdAt: insightReports.createdAt,
			updatedAt: insightReports.updatedAt
		});
	if (!created) throw new Error('Insight report insert returned no row');
	const retentionCutoff = new Date(
		now.getTime() - INSIGHT_SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000
	);
	const snapshotsToRemove = await db
		.select({ id: insightReports.id })
		.from(insightReports)
		.where(
			and(
				eq(insightReports.userId, userId),
				ne(insightReports.id, String(created.id)),
				or(
					lt(insightReports.generatedAt, retentionCutoff),
					sql`${insightReports.lockedAt} is not null`
				)
			)
		);
	if (snapshotsToRemove.length) {
		await db.delete(insightReports).where(
			inArray(
				insightReports.id,
				snapshotsToRemove.map(({ id }) => id)
			)
		);
	}

	const excessSnapshots = await db
		.select({ id: insightReports.id })
		.from(insightReports)
		.where(and(eq(insightReports.userId, userId), gte(insightReports.generatedAt, retentionCutoff)))
		.orderBy(desc(insightReports.generatedAt), desc(insightReports.id))
		.offset(INSIGHT_SNAPSHOT_MAX_PER_USER);
	if (excessSnapshots.length) {
		await db.delete(insightReports).where(
			inArray(
				insightReports.id,
				excessSnapshots.map(({ id }) => id)
			)
		);
	}
	return toInsightReportView(created);
}
