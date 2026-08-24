import type { StoredQuestion } from '$lib/question-bank/mcq/repository.server';
import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';

export function storedQuestionToGenerated(question: StoredQuestion): GeneratedQuestion {
	const options = [
		{ id: 'A', label: 'A', text: question.optionA },
		{ id: 'B', label: 'B', text: question.optionB },
		{ id: 'C', label: 'C', text: question.optionC },
		{ id: 'D', label: 'D', text: question.optionD }
	];

	return {
		questionId: question.id,
		topic: question.mainTopic,
		mainTopic: question.mainTopic,
		source: 'cached',
		prompt: question.question,
		options,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		hint1: question.hint1,
		hint2: question.hint2,
		diagramSpec: question.diagramSpec,
		hasDiagram: question.hasDiagram,
		hasStimulus: false
	};
}

export function storedQuestionToMcqAnswerBody(question: StoredQuestion): Record<string, unknown> {
	return {
		question: question.question,
		optionA: question.optionA,
		optionB: question.optionB,
		optionC: question.optionC,
		optionD: question.optionD,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		mainTopic: question.mainTopic ?? '',
		topicsCovered: question.topicsCovered ?? '',
		hint1: question.hint1 ?? '',
		hint2: question.hint2 ?? '',
		diagramSpec: question.diagramSpec ?? null,
		hasDiagram: question.hasDiagram
	};
}
