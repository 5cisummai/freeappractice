import * as s3 from '$lib/questions/s3.server';
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
