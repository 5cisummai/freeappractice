import type { StoredQuestion } from '$lib/question-bank/mcq/repository.server';
import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';
import { parseQuestionParagraphs } from '$lib/question-bank/mcq/payload';

export function storedQuestionToGenerated(question: StoredQuestion): GeneratedQuestion {
	const diagramSpec = question.diagramSpec ?? question.stimulus?.diagramSpec;
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
		topicsCovered: question.topicsCovered,
		source: 'cached',
		prompt: question.question,
		options,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		...(diagramSpec ? { diagramSpec } : {}),
		hasDiagram: question.hasDiagram || Boolean(question.stimulus?.diagramSpec),
		...(question.stimulus ? { stimulus: question.stimulus } : {}),
		...(question.stimulusId ? { stimulusId: question.stimulusId } : {}),
		...(question.stimulusPosition !== null && question.stimulusPosition !== undefined
			? { stimulusPosition: question.stimulusPosition }
			: {}),
		...(question.stimulusQuestionCount !== null && question.stimulusQuestionCount !== undefined
			? { stimulusQuestionCount: question.stimulusQuestionCount }
			: {}),
		leftPanel: question.stimulus?.text
			? { title: 'Stimulus', content: parseQuestionParagraphs(question.stimulus.text) }
			: undefined,
		rightPanel: question.stimulus
			? { title: 'Question', content: parseQuestionParagraphs(question.question) }
			: undefined,
		hasStimulus: Boolean(question.stimulus)
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
		diagramSpec: question.diagramSpec ?? null,
		hasDiagram: question.hasDiagram,
		...(question.stimulus ? { stimulus: question.stimulus } : {}),
		...(question.stimulusId ? { stimulusId: question.stimulusId } : {}),
		...(question.stimulusPosition !== null && question.stimulusPosition !== undefined
			? { stimulusPosition: question.stimulusPosition }
			: {}),
		...(question.stimulusQuestionCount !== null && question.stimulusQuestionCount !== undefined
			? { stimulusQuestionCount: question.stimulusQuestionCount }
			: {})
	};
}

/** Build the stable answer envelope used by both single-question and quiz APIs. */
export function generatedQuestionToMcqAnswerBody(
	question: GeneratedQuestion
): Record<string, unknown> {
	return {
		question: question.prompt,
		optionA: question.options[0]?.text ?? '',
		optionB: question.options[1]?.text ?? '',
		optionC: question.options[2]?.text ?? '',
		optionD: question.options[3]?.text ?? '',
		correctAnswer: question.correctAnswer,
		explanation: question.explanation ?? '',
		mainTopic: question.mainTopic ?? question.topic ?? '',
		topicsCovered: question.topicsCovered ?? '',
		diagramSpec: question.diagramSpec ?? null,
		hasDiagram: question.hasDiagram ?? false,
		...(question.stimulus ? { stimulus: question.stimulus } : {}),
		...(question.stimulusId ? { stimulusId: question.stimulusId } : {}),
		...(question.stimulusPosition !== undefined
			? { stimulusPosition: question.stimulusPosition }
			: {}),
		...(question.stimulusQuestionCount !== undefined
			? { stimulusQuestionCount: question.stimulusQuestionCount }
			: {})
	};
}
