import { hasS3BackedBody, hasLegacyInlineBody, type IQuestion } from '$lib/questions/cache-model.server';
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

function legacyBodyFromDoc(doc: IQuestion): McqAnswerBody | null {
	if (!hasLegacyInlineBody(doc)) return null;
	if (!doc.optionA || !doc.optionB || !doc.optionC || !doc.optionD) return null;
	if (!doc.correctAnswer || !doc.explanation) return null;
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

/** Load full MCQ body for a pool doc — S3 first, legacy inline fields as fallback. */
export async function loadQuestionBodyFromPoolDoc(
	doc: IQuestion
): Promise<{ questionId: string; answer: McqAnswerBody }> {
	if (hasS3BackedBody(doc)) {
		const stored = await getQuestionFromS3(doc.s3QuestionId);
		return { questionId: doc.s3QuestionId, answer: storedToAnswer(stored) };
	}

	const legacy = legacyBodyFromDoc(doc);
	if (legacy) {
		return { questionId: doc._id.toString(), answer: legacy };
	}

	throw new Error(`Pool doc ${doc._id.toString()} has no s3QuestionId or legacy body`);
}

/** Resolve a stored question shape from a pool doc (for history migration lookups). */
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
