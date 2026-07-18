import { randomUUID } from 'node:crypto';
import * as s3 from '$lib/questions/s3.server';
import { FrqQuestionSchema, type FrqQuestion } from '$lib/frq/types';

type StoredFrqQuestion = FrqQuestion & {
	id: string;
	createdAt: string;
};

export async function saveFrqToS3(question: FrqQuestion): Promise<string> {
	const id = randomUUID();
	const payload: StoredFrqQuestion = {
		id,
		...question,
		createdAt: new Date().toISOString()
	};
	await s3.putObject({
		key: `frqs/${id}.json`,
		body: JSON.stringify(payload),
		contentType: 'application/json'
	});
	return id;
}

export async function getFrqFromS3(questionId: string): Promise<StoredFrqQuestion> {
	const raw = await s3.getObjectJson<Record<string, unknown>>({
		key: `frqs/${questionId}.json`
	});
	const { id, createdAt, ...canonicalQuestion } = raw;
	const question = FrqQuestionSchema.parse(canonicalQuestion);
	return {
		...question,
		id: String(id ?? questionId),
		createdAt: String(createdAt ?? '')
	};
}
