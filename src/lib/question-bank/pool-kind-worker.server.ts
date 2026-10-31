import { generateAndPersistFrq } from '#lib/question-bank/frq/generation.server.js';
import { frqPracticeFor, FRQ_ALL_UNITS } from '#lib/question-bank/frq/practice.js';
import {
	generateQuestionForPool,
	generateStimulusSetForPool
} from '#lib/question-bank/mcq/write.server.js';
import {
	countActiveMcqQuestions,
	countActiveMcqQuestionsByBucket
} from '#lib/question-bank/mcq/repository.server.js';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit,
	type StimulusPolicy
} from '#lib/question-bank/mcq/stimulus-policy.js';
import { isStimulusQuestionsEnabled } from '#lib/flags.js';
import type { PoolRefillQuestionType } from '#lib/question-bank/pool-refill-types.server.js';

type GenerationResult = { skippedDuplicate?: boolean; generatedCount?: number };

async function generateMcqPoolQuestion(
	course: string,
	unit: string,
	target = 0,
	reservedSlots?: number
): Promise<GenerationResult> {
	const childCount =
		reservedSlots ?? (await estimatePoolGenerationSlots('mcq', course, unit, target));
	if (childCount > 1) {
		const profile = getStimulusPolicy(course).profiles[0]!;
		const mode =
			profile.allowedModes[Math.floor(Math.random() * profile.allowedModes.length)] ?? 'text';
		const result = await generateStimulusSetForPool({
			course: course,
			unit,
			childCount,
			mode
		});
		return {
			skippedDuplicate: result.skippedDuplicate,
			generatedCount: result.questionIds.length
		};
	}
	const result = await generateQuestionForPool(course, unit);
	return { skippedDuplicate: result.skippedDuplicate, generatedCount: 1 };
}

const generationAdapters = {
	mcq: generateMcqPoolQuestion,
	frq: (course: string, unit: string) =>
		frqPracticeFor(course)?.control === 'task'
			? generateAndPersistFrq(course, FRQ_ALL_UNITS, undefined, unit)
			: generateAndPersistFrq(course, unit)
} satisfies Record<
	PoolRefillQuestionType,
	(
		course: string,
		unit: string,
		target?: number,
		reservedSlots?: number
	) => Promise<GenerationResult>
>;

/** Worker-only seam. Never import this module from request-path serving code. */
export function generatePoolQuestion(
	questionType: PoolRefillQuestionType,
	course: string,
	unit: string,
	target?: number,
	reservedSlots?: number
): Promise<GenerationResult> {
	return generationAdapters[questionType](course, unit, target, reservedSlots);
}

export function estimateMcqPoolGenerationSlots(opts: {
	target: number;
	activeCount: number;
	activeDiscreteCount: number;
	policy: StimulusPolicy;
}): number {
	const profile = opts.policy.profiles[0];
	if (!profile) return 1;
	const deficit = Math.max(0, opts.target - opts.activeCount);
	const targetStimulusCount = Math.round(
		(opts.target * opts.policy.quizTargetQuestionPercent) / 100
	);
	if (
		opts.activeCount - opts.activeDiscreteCount >= targetStimulusCount ||
		deficit < profile.minChildren
	)
		return 1;
	return Math.min(profile.targetChildren, profile.maxChildren, deficit);
}

function needsMcqSlotCounts(course: string, unit: string, stimulusEnabled: boolean): boolean {
	const policy = getStimulusPolicy(course);
	return (
		stimulusEnabled &&
		policy.setsEnabled &&
		isStimulusPolicyEnabledForUnit(policy, unit) &&
		Boolean(policy.profiles[0])
	);
}

/** Estimate child slots to reserve before a refill call. */
export async function estimatePoolGenerationSlots(
	questionType: PoolRefillQuestionType,
	course: string,
	unit: string,
	target: number
): Promise<number> {
	if (questionType !== 'mcq') return 1;
	if (!needsMcqSlotCounts(course, unit, await isStimulusQuestionsEnabled())) return 1;
	const [activeCount, activeDiscreteCount] = await Promise.all([
		countActiveMcqQuestions(course, unit),
		countActiveMcqQuestions(course, unit, false)
	]);
	return estimateMcqPoolGenerationSlots({
		target,
		activeCount,
		activeDiscreteCount,
		policy: getStimulusPolicy(course)
	});
}

export async function estimatePoolGenerationSlotsForJobs(
	jobs: Array<{
		id: string;
		questionType: PoolRefillQuestionType;
		course: string;
		unit: string;
		target: number;
	}>
): Promise<Map<string, number>> {
	const slots = new Map<string, number>();
	if (!jobs.length) return slots;

	const stimulusEnabled = await isStimulusQuestionsEnabled();
	const counted: typeof jobs = [];
	for (const job of jobs) {
		if (job.questionType !== 'mcq' || !needsMcqSlotCounts(job.course, job.unit, stimulusEnabled)) {
			slots.set(job.id, 1);
			continue;
		}
		counted.push(job);
	}
	if (!counted.length) return slots;

	const buckets = counted.map(({ course, unit }) => ({ course, unit }));
	const [activeByBucket, discreteByBucket] = await Promise.all([
		countActiveMcqQuestionsByBucket(true, buckets),
		countActiveMcqQuestionsByBucket(false, buckets)
	]);
	for (const job of counted) {
		const key = `${job.course}\u0000${job.unit}`;
		slots.set(
			job.id,
			estimateMcqPoolGenerationSlots({
				target: job.target,
				activeCount: activeByBucket.get(key) ?? 0,
				activeDiscreteCount: discreteByBucket.get(key) ?? 0,
				policy: getStimulusPolicy(job.course)
			})
		);
	}
	return slots;
}
