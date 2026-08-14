import { generateAndPersistFrq } from '$lib/frq/generation.server';
import { generateQuestionForPool } from '$lib/questions/pool-write.server';
import type { PoolRefillQuestionType } from '$lib/questions/pool-refill-types.server';

type GenerationResult = { skippedDuplicate?: boolean };

const generationAdapters = {
	mcq: (apClass: string, unit: string) => generateQuestionForPool(apClass, unit),
	frq: (apClass: string, unit: string) => generateAndPersistFrq(apClass, unit)
} satisfies Record<
	PoolRefillQuestionType,
	(apClass: string, unit: string) => Promise<GenerationResult>
>;

/** Worker-only seam. Never import this module from request-path serving code. */
export function generatePoolQuestion(
	questionType: PoolRefillQuestionType,
	apClass: string,
	unit: string
): Promise<GenerationResult> {
	return generationAdapters[questionType](apClass, unit);
}
