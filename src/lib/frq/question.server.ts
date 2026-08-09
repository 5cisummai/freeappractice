import { FrqQuestionModel, toFrqQuestion } from '$lib/frq/model.server';
import type { FrqQuestion } from '$lib/frq/types';

/** Resolve a complete FRQ from its canonical Neon rows. */
export async function getFrqQuestionById(questionId: string): Promise<FrqQuestion> {
	const normalizedId = questionId.trim();
	if (!normalizedId) throw new Error('FRQ question id is required');

	const question = await FrqQuestionModel.findOne({ questionId: normalizedId }).lean();
	if (!question) throw new Error(`FRQ question not found: ${normalizedId}`);
	return toFrqQuestion(question);
}
