import {
	countActiveMcqQuestions,
	findCachedQuestionByPool,
	type McqSelectionContext,
	type IQuestion
} from '$lib/question-bank/mcq/repository.server';
import { QuestionBank } from '$lib/question-bank/runtime.server';
import { normalizeUnit } from '$lib/question-bank/util.server';

type McqAnswerBody = {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	mainTopic: string;
	topicsCovered: string;
	diagramSpec: Record<string, unknown> | null;
	hasDiagram: boolean;
	stimulus?: Record<string, unknown>;
	stimulusId?: string | null;
	stimulusPosition?: number | null;
	stimulusQuestionCount?: number | null;
};

type CachedResult = {
	answer: McqAnswerBody;
	provider: string;
	model: string;
	cached: boolean;
	questionId: string;
	apClass: string;
	unit: string;
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
		| 'mainTopic'
		| 'topicsCovered'
		| 'diagramSpec'
		| 'hasDiagram'
		| 'stimulus'
		| 'stimulusId'
		| 'stimulusPosition'
		| 'stimulusQuestionCount'
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
		mainTopic: doc.mainTopic,
		topicsCovered: doc.topicsCovered ?? '',
		diagramSpec: doc.diagramSpec ?? null,
		hasDiagram: doc.hasDiagram,
		...(doc.stimulus ? { stimulus: doc.stimulus } : {}),
		...(doc.stimulusId ? { stimulusId: doc.stimulusId } : {}),
		...(doc.stimulusPosition !== null && doc.stimulusPosition !== undefined
			? { stimulusPosition: doc.stimulusPosition }
			: {}),
		...(doc.stimulusQuestionCount !== null && doc.stimulusQuestionCount !== undefined
			? { stimulusQuestionCount: doc.stimulusQuestionCount }
			: {})
	};
}

export const mcqBank = new QuestionBank<IQuestion, CachedResult, McqSelectionContext>({
	logScope: 'pool',
	normalizeUnit,
	countActive: countActiveMcqQuestions,
	findRandom: findCachedQuestionByPool,
	resolveContext: async () => {
		const { isStimulusQuestionsEnabled } = await import('$lib/flags');
		return { allowEnhanced: await isStimulusQuestionsEnabled() };
	},
	// Flag resolution happens once per request before the indexed pool lookup.
	serveCached: (doc) => ({
		answer: hotPoolBodyFromDoc(doc),
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc.questionId,
		apClass: doc.apClass,
		unit: doc.unit
	}),
	requestRefill: async (className, unit) => {
		const { requestPoolRefill } = await import('$lib/question-bank/pool-refill-queue.server');
		return requestPoolRefill({ questionType: 'mcq', apClass: className, unit });
	}
});
