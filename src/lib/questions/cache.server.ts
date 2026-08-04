import { Question, type IQuestion } from '$lib/questions/cache-model.server';
import {
	createQuestionPool,
	type GetQuestionOptions,
	type PoolSelectionResult
} from '$lib/questions/pool.server';
import { requestPoolRefill } from '$lib/questions/pool-refill-queue.server';
import { normalizeUnit } from '$lib/questions/util.server';

type McqAnswerBody = {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	topicsCovered: string;
	hint1: string;
	hint2: string;
};

type CachedResult = {
	answer: McqAnswerBody;
	provider: string;
	model: string;
	cached: boolean;
	questionId: string;
};

const MCQ_PROJECTION = {
	s3QuestionId: 1,
	question: 1,
	optionA: 1,
	optionB: 1,
	optionC: 1,
	optionD: 1,
	correctAnswer: 1,
	explanation: 1,
	topicsCovered: 1,
	hint1: 1,
	hint2: 1,
	apClass: 1,
	unit: 1
} as const;

/** Read full MCQ body directly from an active-library pool doc (no S3 round trip). */
function hotPoolBodyFromDoc(
	doc: Pick<
		IQuestion,
		| 'question'
		| 'optionA'
		| 'optionB'
		| 'optionC'
		| 'optionD'
		| 'correctAnswer'
		| 'explanation'
		| 'topicsCovered'
		| 'hint1'
		| 'hint2'
	>
): McqAnswerBody {
	return {
		question: doc.question,
		optionA: doc.optionA,
		optionB: doc.optionB,
		optionC: doc.optionC,
		optionD: doc.optionD,
		correctAnswer: doc.correctAnswer,
		explanation: doc.explanation,
		topicsCovered: doc.topicsCovered ?? '',
		hint1: doc.hint1 ?? '',
		hint2: doc.hint2 ?? ''
	};
}

const mcqPool = createQuestionPool<IQuestion, CachedResult>({
	questionType: 'mcq',
	logScope: 'pool',
	normalizeUnit,
	model: Question,
	projection: { ...MCQ_PROJECTION },
	serveCached: (doc) => ({
		answer: hotPoolBodyFromDoc(doc),
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc.s3QuestionId
	}),
	requestRefill: (className, unit) =>
		requestPoolRefill({ questionType: 'mcq', apClass: className, unit })
});

/** Selection-only MCQ serve. Never invokes LLM or S3 generation. */
export async function getQuestion(
	className: string,
	unit?: string,
	options: GetQuestionOptions = {}
): Promise<PoolSelectionResult<CachedResult>> {
	return mcqPool.getQuestion(className, unit, options);
}
