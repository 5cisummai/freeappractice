/**
 * Question pool fill / serve knobs.
 * MCQ targets: JSON ceilings + demand scaling from generation stats (floor → preferred).
 * Targets are refill floors (generate until ≥ target), not caps — surplus stays active.
 */

import poolTargets from '$lib/data/question-pool-targets.json';

export const QUESTION_POOL_DEFAULT_MCQ_TARGET = poolTargets.defaultMcqTarget;
export const QUESTION_POOL_MIN_MCQ_TARGET = poolTargets.minMcqTarget;
/** @deprecated Prefer preferredMcqTarget(apClass) / resolveMcqTarget — kept as default ceiling. */
export const QUESTION_POOL_MCQ_TARGET = QUESTION_POOL_DEFAULT_MCQ_TARGET;
export const QUESTION_POOL_FRQ_TARGET = poolTargets.frqTarget;

/** Refill enqueue threshold as a fraction of target (e.g. 0.9 → refill below 90%). */
export const QUESTION_POOL_LOW_WATER_RATIO = 0.9;
/** Max LLM generations per cron/worker invocation. */
export const QUESTION_POOL_MAX_GENERATIONS_PER_RUN = 5;
export const QUESTION_POOL_LEASE_TTL_MS = 120_000;
export const QUESTION_POOL_RETRY_DELAY_MS = 60_000;
/**
 * Hard daily LLM generation cap (UTC day).
 * ~5k output tokens/MCQ → 500 gens ≈ 2.5M output tokens/day.
 */
export const QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET = 500;
/** Retry-After seconds on `503 POOL_WARMING`. */
export const QUESTION_POOL_WARMING_RETRY_AFTER_SECONDS = 15;
/** Soft wall-clock budget for one worker run (keep under Vercel maxDuration). */
export const QUESTION_POOL_WORKER_TIME_BUDGET_MS = 50_000;

export type QuestionPoolConfig = {
	/** Default MCQ ceiling when a class is not listed in the JSON map. */
	mcqTarget: number;
	frqTarget: number;
	lowWaterRatio: number;
	maxGenerationsPerRun: number;
	leaseTtlMs: number;
	retryDelayMs: number;
	dailyLlmGenerationBudget: number;
	warmingRetryAfterSeconds: number;
	workerTimeBudgetMs: number;
};

/** Frozen worker/config object; tests may pass a custom `QuestionPoolConfig` instead. */
export const QUESTION_POOL_CONFIG: QuestionPoolConfig = {
	mcqTarget: QUESTION_POOL_DEFAULT_MCQ_TARGET,
	frqTarget: QUESTION_POOL_FRQ_TARGET,
	lowWaterRatio: QUESTION_POOL_LOW_WATER_RATIO,
	maxGenerationsPerRun: QUESTION_POOL_MAX_GENERATIONS_PER_RUN,
	leaseTtlMs: QUESTION_POOL_LEASE_TTL_MS,
	retryDelayMs: QUESTION_POOL_RETRY_DELAY_MS,
	dailyLlmGenerationBudget: QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET,
	warmingRetryAfterSeconds: QUESTION_POOL_WARMING_RETRY_AFTER_SECONDS,
	workerTimeBudgetMs: QUESTION_POOL_WORKER_TIME_BUDGET_MS
};

/** Preferred (max) MCQ target for a class before demand scaling. */
export function preferredMcqTarget(apClass: string): number {
	const mapped = (
		poolTargets.mcqTargetsByClass as Record<string, number | undefined>
	)[apClass];
	return mapped ?? QUESTION_POOL_DEFAULT_MCQ_TARGET;
}

/**
 * Demand-scaled MCQ target for a class.
 * Scales between `minMcqTarget` and the class preferred ceiling using
 * generation-stats share vs the hottest class (1.0 → preferred, 0 → min).
 * With empty stats, returns the preferred ceiling (cold-start fill).
 */
export function resolveMcqTarget(
	apClass: string,
	generationCountsByClass: Record<string, number>
): number {
	const preferred = preferredMcqTarget(apClass);
	const min = QUESTION_POOL_MIN_MCQ_TARGET;
	if (preferred <= min) return preferred;

	const counts = Object.values(generationCountsByClass);
	const maxCount = counts.length > 0 ? Math.max(0, ...counts) : 0;
	if (maxCount <= 0) return preferred;

	const classCount = Math.max(0, generationCountsByClass[apClass] ?? 0);
	const ratio = Math.min(1, classCount / maxCount);
	return Math.round(min + (preferred - min) * ratio);
}

export function poolTargetForBucket(opts: {
	questionType: 'mcq' | 'frq';
	apClass: string;
	generationCountsByClass?: Record<string, number>;
	config?: QuestionPoolConfig;
}): number {
	const config = opts.config ?? QUESTION_POOL_CONFIG;
	switch (opts.questionType) {
		case 'mcq':
			return resolveMcqTarget(opts.apClass, opts.generationCountsByClass ?? {});
		case 'frq':
			return config.frqTarget;
		default: {
			const _exhaustive: never = opts.questionType;
			return _exhaustive;
		}
	}
}

/** @deprecated Prefer poolTargetForBucket — FRQ only / default MCQ ceiling. */
export function poolTargetForType(
	questionType: 'mcq' | 'frq',
	config: QuestionPoolConfig = QUESTION_POOL_CONFIG
): number {
	switch (questionType) {
		case 'mcq':
			return config.mcqTarget;
		case 'frq':
			return config.frqTarget;
		default: {
			const _exhaustive: never = questionType;
			return _exhaustive;
		}
	}
}

export function isBelowLowWater(
	activeCount: number,
	target: number,
	lowWaterRatio: number = QUESTION_POOL_LOW_WATER_RATIO
): boolean {
	if (target <= 0) return false;
	return activeCount < Math.ceil(target * lowWaterRatio);
}
