import * as s3 from '$lib/questions/s3.server';
import { registerQuestionIdSafe } from '$lib/questions/question-id-registry.server';
import { randomUUID } from 'crypto';

export interface QuestionData {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	apClass?: string;
	unit?: string;
	contentHash?: string;
	topicsCovered?: string;
	[key: string]: unknown;
}

export interface StoredQuestion extends QuestionData {
	id: string;
	createdAt: string;
}

export async function saveQuestionToS3(questionData: QuestionData): Promise<string> {
	const questionId = randomUUID();
	const key = `questions/${questionId}.json`;

	const payload: StoredQuestion = {
		id: questionId,
		...questionData,
		createdAt: new Date().toISOString()
	};

	await s3.putObject({ key, body: JSON.stringify(payload), contentType: 'application/json' });
	await registerQuestionIdSafe(questionId);
	return questionId;
}

export async function getQuestionFromS3(questionId: string): Promise<StoredQuestion> {
	const key = `questions/${questionId}.json`;
	const stream = await s3.getObjectStream({ key });

	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as StoredQuestion;
}

export async function getQuestionsFromS3(questionIds: string[]): Promise<StoredQuestion[]> {
	const results = await Promise.all(
		questionIds.map((id) => getQuestionFromS3(id).catch(() => null))
	);
	return results.filter((q): q is StoredQuestion => q !== null);
}

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
