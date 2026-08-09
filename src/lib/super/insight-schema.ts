import { z } from 'zod';

const sourceSchema = z.enum(['mcq', 'frq']);
const windowSchema = z.object({
	name: z.enum(['lifetime', 'last_30_days']),
	count: z.number().int().nonnegative(),
	averagePercentage: z.number().finite().nullable()
});
const trendSchema = z.object({
	direction: z.enum(['improving', 'declining', 'stable', 'insufficient_data']),
	deltaPercentagePoints: z.number().finite().nullable(),
	recentCount: z.number().int().nonnegative(),
	priorCount: z.number().int().nonnegative(),
	recentAveragePercentage: z.number().finite().nullable(),
	priorAveragePercentage: z.number().finite().nullable()
});
const rubricPointWindowSchema = z.object({
	count: z.number().int().nonnegative(),
	pointsEarned: z.number().finite(),
	pointsAvailable: z.number().finite().nonnegative(),
	percentage: z.number().finite().nullable()
});
const metricSchema = z.object({
	source: sourceSchema,
	count: z.number().int().nonnegative(),
	recentCount: z.number().int().nonnegative(),
	lifetimeAveragePercentage: z.number().finite(),
	recentAveragePercentage: z.number().finite().nullable(),
	weightedAveragePercentage: z.number().finite(),
	weighting: z.enum(['lifetime', '70% recent / 30% lifetime']),
	trend: trendSchema,
	windows: z.object({ lifetime: windowSchema, last30Days: windowSchema }),
	rubricPointPerformance: z
		.object({ lifetime: rubricPointWindowSchema, last30Days: rubricPointWindowSchema })
		.optional()
});
const claimSchema = z.object({
	apClass: z.string(),
	unit: z.string(),
	source: sourceSchema,
	metric: metricSchema,
	classification: z.enum(['strength', 'weakness', 'mixed']),
	practiceHref: z.string()
});
const eligibilitySchema = z.object({
	eligible: z.boolean(),
	totalScoredAttempts: z.number().int().nonnegative(),
	mcqScoredAttempts: z.number().int().nonnegative(),
	frqScoredAttempts: z.number().int().nonnegative(),
	minimumTotalAttempts: z.number().int().nonnegative(),
	minimumAttemptsPerClaim: z.number().int().nonnegative(),
	eligibleClaimCount: z.number().int().nonnegative(),
	claimDefinition: z.literal('source + course + unit'),
	reason: z.enum(['eligible', 'needs_more_total_attempts', 'needs_more_attempts_in_a_claim'])
});
const unitSchema = z.object({
	unit: z.string(),
	totalScoredAttempts: z.number().int().nonnegative(),
	metrics: z.object({ mcq: metricSchema.optional(), frq: metricSchema.optional() }),
	strengths: z.array(claimSchema),
	weaknesses: z.array(claimSchema),
	actionableInsights: z.array(z.string())
});
const courseSchema = z.object({
	apClass: z.string(),
	totalScoredAttempts: z.number().int().nonnegative(),
	metrics: z.object({ mcq: metricSchema.optional(), frq: metricSchema.optional() }),
	strengths: z.array(claimSchema),
	weaknesses: z.array(claimSchema),
	actionableInsights: z.array(z.string()),
	units: z.array(unitSchema)
});

export const insightReportDataSchema = z.object({
	schemaVersion: z.literal(1),
	generatedAt: z.string(),
	narrative: z.string().nullable(),
	calculation: z.object({
		asOf: z.string(),
		recentWindowDays: z.literal(30),
		recentMinimumAttempts: z.literal(5),
		recentWeight: z.literal(0.7),
		lifetimeWeight: z.literal(0.3),
		trendWindowDays: z.literal(30),
		trendMinimumAttempts: z.literal(5),
		trendStableThresholdPercentagePoints: z.literal(3),
		windowNames: z.tuple([z.literal('lifetime'), z.literal('last_30_days')])
	}),
	eligibility: eligibilitySchema,
	strengths: z.array(claimSchema),
	weaknesses: z.array(claimSchema),
	actionableInsights: z.array(z.string()),
	courses: z.array(courseSchema)
});

export type ParsedInsightReportData = z.infer<typeof insightReportDataSchema>;
