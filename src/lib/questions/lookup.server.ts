import { getQuestionsFromS3, type StoredQuestion } from '$lib/questions/storage.server';

/** Build a lookup map keyed by canonical S3 ids. */
export async function getQuestionsLookupMap(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const uniqueIds = [...new Set(questionIds)];
	const map = new Map<string, StoredQuestion>();
	if (uniqueIds.length === 0) return map;

	const fromS3 = await getQuestionsFromS3(uniqueIds);

	for (const question of fromS3) {
		map.set(question.id, question);
	}

	return map;
}

/** Resolve question payloads by canonical S3 id. */
export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds)];
	if (uniqueIds.length === 0) return [];

	const map = await getQuestionsLookupMap(uniqueIds);
	return uniqueIds.map((id) => map.get(id)).filter((q): q is StoredQuestion => q !== undefined);
}
