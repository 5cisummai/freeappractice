import type { IQuestion } from '$lib/questions/cache-model.server';

export type McqAnswerBody = {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	topicsCovered?: string;
	hint1: string;
	hint2: string;
};

/** Read full MCQ body directly from a hot-cache pool doc (no S3 round trip). */
export function hotPoolBodyFromDoc(doc: IQuestion): McqAnswerBody {
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
