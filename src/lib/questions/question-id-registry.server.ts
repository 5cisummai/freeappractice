import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { QuestionId } from '$lib/questions/question-id-model.server';

/** Record a canonical S3 question id (idempotent upsert). */
export async function registerQuestionId(questionId: string): Promise<void> {
	const trimmed = questionId.trim();
	if (!trimmed) return;

	await connectDb();
	await QuestionId.updateOne(
		{ questionId: trimmed },
		{ $setOnInsert: { questionId: trimmed } },
		{ upsert: true }
	);
}

/** Register without failing the caller if Mongo is unavailable. */
export async function registerQuestionIdSafe(questionId: string): Promise<void> {
	try {
		await registerQuestionId(questionId);
	} catch (e) {
		logger.error('registerQuestionId failed', {
			error: e instanceof Error ? e.message : String(e),
			questionId
		});
	}
}
