import { generateAndPersistFrq } from '$lib/question-bank/frq/generation.server';
import { frqPracticeFor, FRQ_ALL_UNITS } from '$lib/question-bank/frq/practice';
import {
	generateQuestionForPool,
	generateStimulusSetForPool
} from '$lib/question-bank/mcq/write.server';
import { countActiveMcqQuestions } from '$lib/question-bank/mcq/repository.server';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit
} from '$lib/question-bank/mcq/stimulus-policy';
import { isStimulusQuestionsEnabled } from '$lib/flags';
import type { PoolRefillQuestionType } from '$lib/question-bank/pool-refill-types.server';

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

/** Estimate child slots to reserve before a refill call. */
export async function estimatePoolGenerationSlots(
	questionType: PoolRefillQuestionType,
	course: string,
	unit: string,
	target: number
): Promise<number> {
	if (questionType !== 'mcq') return 1;
	const policy = getStimulusPolicy(course);
	if (
		!(await isStimulusQuestionsEnabled()) ||
		!policy.setsEnabled ||
		!isStimulusPolicyEnabledForUnit(policy, unit)
	)
		return 1;
	const profile = policy.profiles[0];
	if (!profile) return 1;
	const [activeCount, activeDiscreteCount] = await Promise.all([
		countActiveMcqQuestions(course, unit),
		countActiveMcqQuestions(course, unit, false)
	]);
	const deficit = Math.max(0, target - activeCount);
	const targetStimulusCount = Math.round((target * policy.quizTargetQuestionPercent) / 100);
	if (activeCount - activeDiscreteCount >= targetStimulusCount || deficit < profile.minChildren)
		return 1;
	return Math.min(profile.targetChildren, profile.maxChildren, deficit);
}
