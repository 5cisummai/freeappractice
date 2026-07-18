import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { QuestionId } from '$lib/questions/question-id-model.server';

export interface QuestionRegistryMetadata {
	apClass?: string;
	unit?: string;
	questionCreatedAt?: Date;
	s3Etag?: string;
	contentHash?: string;
	contentLength?: number;
	metadataSyncedAt?: Date;
}

/** Record a canonical S3 question id and any known metadata (idempotent upsert). */
export async function registerQuestionId(
	questionId: string,
	metadata: QuestionRegistryMetadata = {}
): Promise<void> {
	const trimmed = questionId.trim();
	if (!trimmed) return;

	await connectDb();
	await QuestionId.updateOne(
		{ questionId: trimmed },
		{
			$setOnInsert: { questionId: trimmed },
			...(Object.keys(metadata).length ? { $set: metadata } : {})
		},
		{ upsert: true }
	);
}

/** Register without failing the caller if Mongo is unavailable. */
export async function registerQuestionIdSafe(
	questionId: string,
	metadata: QuestionRegistryMetadata = {}
): Promise<void> {
	try {
		await registerQuestionId(questionId, metadata);
	} catch (e) {
		logger.error('registerQuestionId failed', {
			error: e instanceof Error ? e.message : String(e),
			questionId
		});
	}
}
