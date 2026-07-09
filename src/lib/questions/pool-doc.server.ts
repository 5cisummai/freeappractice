import type { APQuestionData } from '$lib/questions/generation.server';
import type { IQuestion } from '$lib/questions/cache-model.server';

/** Build an ephemeral hot-cache pool document with the full MCQ body inline. */
export function buildHotPoolDoc(opts: {
	s3QuestionId: string;
	apClass: string;
	unit: string;
	contentHash: string;
	topicsCovered: string;
	answer: APQuestionData;
}): Pick<
	IQuestion,
	| 's3QuestionId'
	| 'apClass'
	| 'unit'
	| 'contentHash'
	| 'topicsCovered'
	| 'question'
	| 'optionA'
	| 'optionB'
	| 'optionC'
	| 'optionD'
	| 'correctAnswer'
	| 'explanation'
> {
	const { answer } = opts;
	return {
		s3QuestionId: opts.s3QuestionId,
		apClass: opts.apClass,
		unit: opts.unit,
		contentHash: opts.contentHash,
		topicsCovered: opts.topicsCovered,
		question: answer.question,
		optionA: answer.optionA,
		optionB: answer.optionB,
		optionC: answer.optionC,
		optionD: answer.optionD,
		correctAnswer: answer.correctAnswer,
		explanation: answer.explanation
	};
}
