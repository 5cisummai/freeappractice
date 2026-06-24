import { CUSTOM_UNIT_VALUE, hashTopicKey, isCustomUnit } from '$lib/constants/custom-unit';
import type { AnswerResult, GeneratedQuestion, QuestionOption } from '$lib/types/question';

export interface McqPersistedState {
	currentQuestion: GeneratedQuestion;
	hasCheckedAnswer: boolean;
	checkedSelection: string | null;
	answerResult: AnswerResult | null;
	selectedOption: string | null;
	showExplanation: boolean;
	statusMessage: string;
	startedAtMs: number;
	questionCount: number;
}

function isQuestionOption(value: unknown): value is QuestionOption {
	if (!value || typeof value !== 'object') return false;
	const option = value as QuestionOption;
	return typeof option.id === 'string' && typeof option.text === 'string';
}

function isGeneratedQuestion(value: unknown): value is GeneratedQuestion {
	if (!value || typeof value !== 'object') return false;
	const question = value as GeneratedQuestion;
	if (typeof question.prompt !== 'string' || !Array.isArray(question.options)) {
		return false;
	}
	if (!question.options.every(isQuestionOption)) return false;
	if (question.correctAnswer !== undefined && typeof question.correctAnswer !== 'string') {
		return false;
	}
	return true;
}

function isAnswerResult(value: unknown): value is AnswerResult {
	if (!value || typeof value !== 'object') return false;
	const result = value as AnswerResult;
	return (
		typeof result.selectedAnswer === 'string' &&
		typeof result.correctAnswer === 'string' &&
		typeof result.isCorrect === 'boolean' &&
		typeof result.timeTakenMs === 'number'
	);
}

export function getPracticeStorageKey(
	selectedClass: string,
	selectedUnit: string,
	customTopic: string
): string {
	const unitPart = isCustomUnit(selectedUnit)
		? `${CUSTOM_UNIT_VALUE}_${hashTopicKey(customTopic.trim())}`
		: selectedUnit;
	return `practice_q_mcq_${selectedClass}_${unitPart}`;
}

export type SavePracticeResult = { ok: true } | { ok: false; warning: string };

function readPracticeStorageJson(key: string): {
	data: Record<string, unknown> | null;
	restoreFailed?: boolean;
} {
	if (typeof localStorage === 'undefined') return { data: null };
	try {
		const stored = localStorage.getItem(key);
		if (!stored) return { data: null };
		return { data: JSON.parse(stored) as Record<string, unknown> };
	} catch {
		localStorage.removeItem(key);
		return { data: null, restoreFailed: true };
	}
}

export function saveMcqPracticeState(
	key: string,
	state: McqPersistedState | null
): SavePracticeResult {
	if (typeof localStorage === 'undefined') return { ok: true };
	try {
		if (!state) {
			localStorage.removeItem(key);
			return { ok: true };
		}
		localStorage.setItem(key, JSON.stringify(state));
		return { ok: true };
	} catch {
		return {
			ok: false,
			warning: 'Progress could not be saved locally. Your current attempt is still active.'
		};
	}
}

export function loadMcqPracticeState(key: string): {
	state: McqPersistedState | null;
	restoreFailed?: boolean;
} {
	const { data, restoreFailed } = readPracticeStorageJson(key);
	if (!data?.currentQuestion || !isGeneratedQuestion(data.currentQuestion)) {
		return { state: null, restoreFailed };
	}

	const answerResult =
		data.answerResult === null || data.answerResult === undefined
			? null
			: isAnswerResult(data.answerResult)
				? data.answerResult
				: null;

	return {
		state: {
			currentQuestion: data.currentQuestion,
			hasCheckedAnswer: Boolean(data.hasCheckedAnswer),
			checkedSelection: typeof data.checkedSelection === 'string' ? data.checkedSelection : null,
			answerResult,
			selectedOption: typeof data.selectedOption === 'string' ? data.selectedOption : null,
			showExplanation: Boolean(data.showExplanation),
			statusMessage: typeof data.statusMessage === 'string' ? data.statusMessage : '',
			startedAtMs: typeof data.startedAtMs === 'number' ? data.startedAtMs : Date.now(),
			questionCount: typeof data.questionCount === 'number' ? data.questionCount : 0
		},
		restoreFailed
	};
}

export const RESTORE_FAILED_WARNING =
	'Saved progress could not be restored, so a fresh practice session was started.';
