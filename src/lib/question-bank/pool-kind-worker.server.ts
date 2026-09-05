import { generateAndPersistFrq } from '$lib/question-bank/frq/generation.server';
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
	apClass: string,
	unit: string,
	target = 0
): Promise<GenerationResult> {
	const childCount = await estimatePoolGenerationSlots('mcq', apClass, unit, target);
	if (childCount > 1) {
		const profile = getStimulusPolicy(apClass).profiles[0]!;
		const mode =
			profile.allowedModes[Math.floor(Math.random() * profile.allowedModes.length)] ?? 'text';
		const result = await generateStimulusSetForPool({
			className: apClass,
			unit,
			childCount,
			mode
		});
		return {
			skippedDuplicate: result.skippedDuplicate,
			generatedCount: result.questionIds.length
		};
	}
	const result = await generateQuestionForPool(apClass, unit);
	return { skippedDuplicate: result.skippedDuplicate, generatedCount: 1 };
}

const generationAdapters = {
	mcq: generateMcqPoolQuestion,
	frq: (apClass: string, unit: string) => generateAndPersistFrq(apClass, unit)
} satisfies Record<
	PoolRefillQuestionType,
	(apClass: string, unit: string, target?: number) => Promise<GenerationResult>
>;

/** Worker-only seam. Never import this module from request-path serving code. */
export function generatePoolQuestion(
	questionType: PoolRefillQuestionType,
	apClass: string,
	unit: string,
	target?: number
): Promise<GenerationResult> {
	return generationAdapters[questionType](apClass, unit, target);
}

/** Estimate child slots to reserve before a refill call. */
export async function estimatePoolGenerationSlots(
	questionType: PoolRefillQuestionType,
	apClass: string,
	unit: string,
	target: number
): Promise<number> {
	if (questionType !== 'mcq') return 1;
	const policy = getStimulusPolicy(apClass);
	if (
		!(await isStimulusQuestionsEnabled()) ||
		!policy.setsEnabled ||
		!isStimulusPolicyEnabledForUnit(policy, unit)
	)
		return 1;
	const profile = policy.profiles[0];
	if (!profile) return 1;
	const activeCount = await countActiveMcqQuestions(apClass, unit);
	const activeDiscreteCount = await countActiveMcqQuestions(apClass, unit, {
		allowEnhanced: false
	});
	const deficit = Math.max(0, target - activeCount);
	const targetStimulusCount = Math.round((target * policy.quizTargetQuestionPercent) / 100);
	if (activeCount - activeDiscreteCount >= targetStimulusCount || deficit < profile.minChildren)
		return 1;
	return Math.min(profile.targetChildren, profile.maxChildren, deficit);
}
