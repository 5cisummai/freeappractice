import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { questionRegistry } from '$lib/server/neon/schema';

export interface QuestionRegistryMetadata {
	apClass?: string;
	unit?: string;
	questionCreatedAt?: Date;
	s3Etag?: string;
	contentHash?: string;
	contentLength?: number;
	metadataSyncedAt?: Date;
}

/** Record a canonical question id and its metadata (idempotent upsert). */
async function registerQuestionId(
	questionId: string,
	metadata: QuestionRegistryMetadata = {}
): Promise<void> {
	const trimmed = questionId.trim();
	if (!trimmed) return;

	await getNeonDatabase()
		.insert(questionRegistry)
		.values({ questionId: trimmed, kind: 'mcq', ...metadata })
		.onConflictDoUpdate({
			target: questionRegistry.questionId,
			set: metadata
		});
}

/** Register without failing the caller if the Neon registry is unavailable. */
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
