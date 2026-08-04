import { env } from '$env/dynamic/private';

const COLLECTION_NAME = /^[A-Za-z0-9_.-]+$/;

function configuredCollection(name: string | undefined, fallback: string): string {
	const value = name?.trim() || fallback;
	if (!COLLECTION_NAME.test(value)) {
		throw new Error(`Invalid Mongo collection name: ${JSON.stringify(value)}`);
	}
	return value;
}

export const MCQ_POOL_COLLECTION = configuredCollection(
	env.QUESTION_POOL_MCQ_COLLECTION,
	'questions'
);

export const FRQ_POOL_COLLECTION = configuredCollection(
	env.QUESTION_POOL_FRQ_COLLECTION,
	'frqquestions'
);
