import { hasHotPoolBody, hasPersistedS3Id, hasS3OnlyBody, type IQuestion } from '$lib/questions/cache-model.server';
import { getQuestionFromS3, type StoredQuestion } from '$lib/questions/storage.server';

export type McqAnswerBody = {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	topicsCovered?: string;
};

/** Read full MCQ body directly from a hot-cache pool doc (no S3 round trip). */
export function hotPoolBodyFromDoc(doc: IQuestion): McqAnswerBody {
	if (!hasHotPoolBody(doc)) {
		throw new Error(`Pool doc ${doc._id.toString()} has no inline hot-cache body`);
	}
	return {
		question: doc.question,
		optionA: doc.optionA,
		optionB: doc.optionB,
		optionC: doc.optionC,
		optionD: doc.optionD,
		correctAnswer: doc.correctAnswer,
		explanation: doc.explanation,
		topicsCovered: doc.topicsCovered ?? ''
	};
}

function storedToAnswer(stored: StoredQuestion): McqAnswerBody {
	return {
		question: stored.question,
		optionA: stored.optionA,
		optionB: stored.optionB,
		optionC: stored.optionC,
		optionD: stored.optionD,
		correctAnswer: stored.correctAnswer,
		explanation: stored.explanation,
		topicsCovered: typeof stored.topicsCovered === 'string' ? stored.topicsCovered : ''
	};
}

/**
 * Load MCQ body for history lookup — inline hot cache first, S3 pointer fallback for
 * pre-migration slim pool docs only.
 */
export async function loadQuestionBodyFromPoolDoc(
	doc: IQuestion
): Promise<{ questionId: string; answer: McqAnswerBody }> {
	if (hasHotPoolBody(doc) && hasPersistedS3Id(doc)) {
		return { questionId: doc.s3QuestionId, answer: hotPoolBodyFromDoc(doc) };
	}

	if (hasHotPoolBody(doc)) {
		return { questionId: doc._id.toString(), answer: hotPoolBodyFromDoc(doc) };
	}

	if (hasS3OnlyBody(doc)) {
		const stored = await getQuestionFromS3(doc.s3QuestionId);
		return { questionId: doc.s3QuestionId, answer: storedToAnswer(stored) };
	}

	throw new Error(`Pool doc ${doc._id.toString()} has no inline body or s3QuestionId`);
}

/** Resolve a stored question shape from a pool doc (for legacy history lookups). */
export async function resolveStoredQuestionFromPoolDoc(
	doc: IQuestion
): Promise<StoredQuestion | null> {
	try {
		const { questionId, answer } = await loadQuestionBodyFromPoolDoc(doc);
		return {
			id: questionId,
			...answer,
			apClass: doc.apClass,
			unit: doc.unit,
			createdAt:
				doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString()
		};
	} catch {
		return null;
	}
}
