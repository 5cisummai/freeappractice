import mongoose from 'mongoose';
import { Question } from '$lib/questions/cache-model.server';
import { connectDb } from '$lib/server/db';
import { resolveStoredQuestionFromPoolDoc } from '$lib/questions/pool-resolve.server';
import { getQuestionsFromS3, type StoredQuestion } from '$lib/questions/storage.server';

function isMongoObjectId(id: string): boolean {
	return /^[0-9a-f]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
}

function isUuid(id: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

async function resolveLegacyPoolQuestions(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const map = new Map<string, StoredQuestion>();
	if (questionIds.length === 0) return map;

	await connectDb();
	const objectIds = questionIds.filter(isMongoObjectId).map((id) => new mongoose.Types.ObjectId(id));
	if (objectIds.length === 0) return map;

	const docs = await Question.find({ _id: { $in: objectIds } }).lean();
	for (const doc of docs) {
		const resolved = await resolveStoredQuestionFromPoolDoc(doc);
		if (resolved) {
			map.set(doc._id.toString(), resolved);
		}
	}
	return map;
}

/** Build a lookup map keyed by both requested ids and canonical S3 ids. */
export async function getQuestionsLookupMap(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const uniqueIds = [...new Set(questionIds)];
	const map = new Map<string, StoredQuestion>();
	if (uniqueIds.length === 0) return map;

	const s3Ids = uniqueIds.filter((id) => isUuid(id) || !isMongoObjectId(id));
	const legacyMongoIds = uniqueIds.filter(isMongoObjectId);

	const [fromS3, legacyByMongoId] = await Promise.all([
		s3Ids.length > 0 ? getQuestionsFromS3(s3Ids) : Promise.resolve([]),
		legacyMongoIds.length > 0 ? resolveLegacyPoolQuestions(legacyMongoIds) : Promise.resolve(new Map())
	]);

	for (const question of fromS3) {
		map.set(question.id, question);
	}
	for (const [mongoId, question] of legacyByMongoId) {
		map.set(mongoId, question);
		map.set(question.id, question);
	}

	return map;
}

/** Resolve question payloads by canonical S3 UUID, with legacy Mongo pool fallback during migration. */
export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds)];
	if (uniqueIds.length === 0) return [];

	const map = await getQuestionsLookupMap(uniqueIds);
	return uniqueIds.map((id) => map.get(id)).filter((q): q is StoredQuestion => q !== undefined);
}
