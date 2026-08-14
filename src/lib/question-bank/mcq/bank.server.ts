import {
	countActiveMcqQuestions,
	findCachedQuestionByPool,
	type IQuestion
} from '$lib/question-bank/mcq/repository.server';
import {
	QuestionBank,
	type GetQuestionOptions,
	type PoolSelectionResult
} from '$lib/question-bank/runtime.server';
import { normalizeUnit } from '$lib/question-bank/util.server';

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
	diagramSpec: Record<string, unknown> | null;
	hasDiagram: boolean;
};

type CachedResult = {
	answer: McqAnswerBody;
	provider: string;
	model: string;
	cached: boolean;
	questionId: string;
};

/** Read full MCQ body directly from an active-library Neon row. */
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
		| 'diagramSpec'
		| 'hasDiagram'
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
		hint2: doc.hint2 ?? '',
		diagramSpec: doc.diagramSpec ?? null,
		hasDiagram: doc.hasDiagram
	};
}

export const mcqBank = new QuestionBank<IQuestion, CachedResult>({
	questionType: 'mcq',
	logScope: 'pool',
	normalizeUnit,
	countActive: countActiveMcqQuestions,
	findRandom: findCachedQuestionByPool,
	// Diagram availability is decided during generation. Serving a cached row
	// must remain a synchronous pool-hit path and never initialize Flags.
	serveCached: (doc) => ({
		answer: hotPoolBodyFromDoc(doc),
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc.questionId
	}),
	requestRefill: async (className, unit) => {
		const { requestPoolRefill } = await import('$lib/question-bank/pool-refill-queue.server');
		return requestPoolRefill({ questionType: 'mcq', apClass: className, unit });
	}
});

/** Selection-only MCQ serve. Never invokes LLM or generation. */
export async function getQuestion(
	className: string,
	unit?: string,
	options: GetQuestionOptions = {}
): Promise<PoolSelectionResult<CachedResult>> {
	return mcqBank.get(className, unit, options);
}
