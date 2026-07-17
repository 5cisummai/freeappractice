import { randomUUID } from 'node:crypto';
import * as s3 from '$lib/questions/s3.server';
import { FrqQuestionSchema, type FrqQuestion } from '$lib/frq/types';

export type StoredFrqQuestion = FrqQuestion & {
	id: string;
	createdAt: string;
};

async function readStream(stream: AsyncIterable<Uint8Array | Buffer>): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString('utf-8');
}

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
	const stream = await s3.getObjectStream({ key: `frqs/${questionId}.json` });
	const raw = JSON.parse(await readStream(stream)) as Record<string, unknown>;
	const { id, createdAt, ...canonicalQuestion } = raw;
	const question = FrqQuestionSchema.parse(canonicalQuestion);
	return {
		...question,
		id: String(id ?? questionId),
		createdAt: String(createdAt ?? '')
	};
}
