import {
	findAllCachedQuestions,
	findCachedQuestion,
	findCachedQuestions,
	type IQuestion
} from '$lib/questions/cache-model.server';

export interface StoredQuestion {
	id: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	hint1?: string;
	hint2?: string;
	apClass?: string;
	unit?: string;
	contentHash?: string;
	topicsCovered?: string;
	createdAt: string;
}

function toStoredQuestion(question: IQuestion): StoredQuestion {
	return {
		id: question.questionId,
		question: question.question,
		optionA: question.optionA,
		optionB: question.optionB,
		optionC: question.optionC,
		optionD: question.optionD,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		...(question.hint1 != null ? { hint1: question.hint1 } : {}),
		...(question.hint2 != null ? { hint2: question.hint2 } : {}),
		apClass: question.apClass,
		unit: question.unit,
		contentHash: question.contentHash,
		topicsCovered: question.topicsCovered ?? undefined,
		createdAt: new Date(question.createdAt).toISOString()
	};
}

/** Resolve an MCQ body from its canonical Neon row. */
export async function getQuestionById(questionId: string): Promise<StoredQuestion> {
	const normalizedId = questionId.trim();
	if (!normalizedId) throw new Error('Question id is required');

	const question = await findCachedQuestion(normalizedId);
	if (!question) throw new Error(`Question not found: ${normalizedId}`);
	return toStoredQuestion(question);
}

/** Build a lookup map from canonical Neon MCQ rows. */
export async function getQuestionsLookupMap(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	const map = new Map<string, StoredQuestion>();
	if (uniqueIds.length === 0) return map;

	const questions = await findCachedQuestions(uniqueIds);
	for (const question of questions) {
		const stored = toStoredQuestion(question);
		map.set(stored.id, stored);
	}
	return map;
}

export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	if (uniqueIds.length === 0) return [];

	const map = await getQuestionsLookupMap(uniqueIds);
	return uniqueIds.map((id) => map.get(id)).filter((q): q is StoredQuestion => q !== undefined);
}

/** List all canonical MCQs for maintenance and quality tooling. */
export async function getAllQuestions(): Promise<StoredQuestion[]> {
	const questions = await findAllCachedQuestions();
	return questions.map(toStoredQuestion);
}
