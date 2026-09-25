import {
	findFrqQuestionByPool,
	countActiveFrqQuestions,
	toFrqQuestion,
	type IFrqQuestion
} from '$lib/question-bank/frq/model.server';
import { toPublicFrqQuestion, type PublicFrqQuestion } from '$lib/question-bank/frq/types';
import { QuestionBank } from '$lib/question-bank/runtime.server';
import { scheduleBackgroundTask } from '$lib/server/background-task.server';

type FrqServiceResult = {
	publicQuestion: PublicFrqQuestion;
	provider: string;
	model: string;
	questionId: string;
	cached: boolean;
};

export const frqBank = new QuestionBank<IFrqQuestion, FrqServiceResult>({
	logScope: 'frq-pool',
	countActive: countActiveFrqQuestions,
	findRandom: findFrqQuestionByPool,
	scheduleBackgroundTask,
	serveCached: (doc) => {
		const question = toFrqQuestion(doc);
		return {
			publicQuestion: toPublicFrqQuestion(doc.questionId, question),
			provider: 'cache',
			model: 'cached',
			questionId: doc.questionId,
			cached: true
		};
	},
	requestRefill: async (course, unit) => {
		const { requestPoolRefill } = await import('$lib/question-bank/pool-refill-queue.server');
		return requestPoolRefill({ questionType: 'frq', course, unit });
	}
});
