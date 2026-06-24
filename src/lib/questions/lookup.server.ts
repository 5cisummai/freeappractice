import mongoose from 'mongoose';
import { Question } from '$lib/questions/cache-model.server';
import { connectDb } from '$lib/server/db';
import { getQuestionsFromS3, type StoredQuestion } from '$lib/questions/storage.server';

function isMongoObjectId(id: string): boolean {
	return /^[0-9a-f]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
}

async function getQuestionsFromCache(questionIds: string[]): Promise<StoredQuestion[]> {
	if (questionIds.length === 0) return [];

	await connectDb();
	const docs = await Question.find({ _id: { $in: questionIds } }).lean();

	return docs.map((doc) => ({
		id: doc._id.toString(),
		question: doc.question,
		optionA: doc.optionA,
		optionB: doc.optionB,
		optionC: doc.optionC,
		optionD: doc.optionD,
		correctAnswer: doc.correctAnswer,
		explanation: doc.explanation,
		apClass: doc.apClass,
		unit: doc.unit,
		createdAt:
			doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString()
	}));
}

/** Resolve question payloads by ID from S3 (live-generated) or the Mongo cache pool. */
export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds)];
	if (uniqueIds.length === 0) return [];

	const s3Ids = uniqueIds.filter((id) => !isMongoObjectId(id));
	const cacheIds = uniqueIds.filter(isMongoObjectId);

	const [fromS3, fromCache] = await Promise.all([
		s3Ids.length > 0 ? getQuestionsFromS3(s3Ids) : Promise.resolve([]),
		cacheIds.length > 0 ? getQuestionsFromCache(cacheIds) : Promise.resolve([])
	]);

	return [...fromS3, ...fromCache];
}
