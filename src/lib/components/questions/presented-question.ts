import type { PublicFrqQuestion } from '$lib/question-bank/frq/types';
import type { GeneratedQuestion, QuestionOption, QuestionPanel } from '$lib/question-bank/mcq/types';

export type PresentedMaterial = {
	id: string;
	title?: string;
	content: string;
};

export type PresentedStem = {
	questionId?: string;
	prompt: string;
	materials?: PresentedMaterial[];
	leftPanel?: QuestionPanel;
	rightPanel?: QuestionPanel;
	diagramSpec?: Record<string, unknown>;
	hasStimulus: boolean;
	options?: QuestionOption[];
};

export function presentedStemFromMcq(question: GeneratedQuestion): PresentedStem {
	return {
		questionId: question.questionId,
		prompt: question.prompt,
		leftPanel: question.leftPanel,
		rightPanel: question.rightPanel,
		diagramSpec: question.diagramSpec,
		hasStimulus: question.hasStimulus,
		options: question.options
	};
}

export function presentedStemFromFrq(question: PublicFrqQuestion): PresentedStem {
	return {
		questionId: question.questionId,
		prompt: question.prompt,
		materials: question.materials.map((material) => ({
			id: material.id,
			title: material.title,
			content: material.content
		})),
		hasStimulus: question.materials.length > 0
	};
}
