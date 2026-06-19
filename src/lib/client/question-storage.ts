import { CUSTOM_UNIT_VALUE, hashTopicKey, isCustomUnit } from '$lib/constants/custom-unit';
import type { AnswerResult, FRQGrade, FRQQuestion, GeneratedQuestion } from '$lib/types/question';

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

export interface FrqPersistedState {
	frqQuestion: FRQQuestion;
	frqResponses: Record<string, string>;
	frqGrade: FRQGrade | null;
	hasSubmitted: boolean;
	statusMessage: string;
	startedAtMs: number;
	questionCount: number;
}

export function getPracticeStorageKey(
	mode: 'mcq' | 'frq',
	selectedClass: string,
	selectedUnit: string,
	customTopic: string
): string {
	const unitPart = isCustomUnit(selectedUnit)
		? `${CUSTOM_UNIT_VALUE}_${hashTopicKey(customTopic.trim())}`
		: selectedUnit;
	return `practice_q_${mode}_${selectedClass}_${unitPart}`;
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

export function saveFrqPracticeState(
	key: string,
	state: FrqPersistedState | null
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
	if (!data?.currentQuestion) return { state: null, restoreFailed };
	return {
		state: {
			currentQuestion: data.currentQuestion as GeneratedQuestion,
			hasCheckedAnswer: Boolean(data.hasCheckedAnswer),
			checkedSelection: (data.checkedSelection as string | null) ?? null,
			answerResult: (data.answerResult as AnswerResult | null) ?? null,
			selectedOption: (data.selectedOption as string | null) ?? null,
			showExplanation: Boolean(data.showExplanation),
			statusMessage: typeof data.statusMessage === 'string' ? data.statusMessage : '',
			startedAtMs: typeof data.startedAtMs === 'number' ? data.startedAtMs : Date.now(),
			questionCount: typeof data.questionCount === 'number' ? data.questionCount : 0
		},
		restoreFailed
	};
}

export function loadFrqPracticeState(key: string): {
	state: FrqPersistedState | null;
	restoreFailed?: boolean;
} {
	const { data, restoreFailed } = readPracticeStorageJson(key);
	if (!data?.frqQuestion) return { state: null, restoreFailed };
	return {
		state: {
			frqQuestion: data.frqQuestion as FRQQuestion,
			frqResponses: (data.frqResponses as Record<string, string>) ?? {},
			frqGrade: (data.frqGrade as FRQGrade | null) ?? null,
			hasSubmitted: Boolean(data.hasSubmitted),
			statusMessage: typeof data.statusMessage === 'string' ? data.statusMessage : '',
			startedAtMs: typeof data.startedAtMs === 'number' ? data.startedAtMs : Date.now(),
			questionCount: typeof data.questionCount === 'number' ? data.questionCount : 0
		},
		restoreFailed
	};
}

export const RESTORE_FAILED_WARNING =
	'Saved progress could not be restored, so a fresh practice session was started.';
