import type { TerminalOutcome } from '$lib/practice/multi-attempt';

type MultiAttemptPhase = 'answering' | 'hinted' | 'terminal';

export type MultiAttemptMachineState = {
	phase: MultiAttemptPhase;
	answers: Array<'A' | 'B' | 'C' | 'D'>;
	lockedChoices: Array<'A' | 'B' | 'C' | 'D'>;
	hintsShown: number;
	terminalOutcome: TerminalOutcome | null;
	firstAnswerCorrect: boolean | null;
	resolvedCorrect: boolean | null;
};

export function createMultiAttemptState(): MultiAttemptMachineState {
	return {
		phase: 'answering',
		answers: [],
		lockedChoices: [],
		hintsShown: 0,
		terminalOutcome: null,
		firstAnswerCorrect: null,
		resolvedCorrect: null
	};
}

type MultiAttemptEvent =
	| { type: 'submit'; answer: 'A' | 'B' | 'C' | 'D'; correctAnswer: 'A' | 'B' | 'C' | 'D' }
	| { type: 'reveal' };

export function reduceMultiAttempt(
	state: MultiAttemptMachineState,
	event: MultiAttemptEvent
): MultiAttemptMachineState {
	if (state.phase === 'terminal') return state;

	if (event.type === 'reveal') {
		return {
			...state,
			phase: 'terminal',
			terminalOutcome: 'revealed',
			resolvedCorrect: false
		};
	}

	const { answer, correctAnswer } = event;
	if (state.lockedChoices.includes(answer)) return state;
	if (state.answers.length >= 3) return state;

	const answers = [...state.answers, answer];
	const firstAnswerCorrect =
		state.firstAnswerCorrect === null ? answer === correctAnswer : state.firstAnswerCorrect;

	if (answer === correctAnswer) {
		return {
			...state,
			answers,
			firstAnswerCorrect,
			resolvedCorrect: true,
			phase: 'terminal',
			terminalOutcome: 'correct'
		};
	}

	const lockedChoices = [...state.lockedChoices, answer];
	const hintsShown = Math.min(2, state.hintsShown + 1);

	if (answers.length >= 3) {
		return {
			...state,
			answers,
			lockedChoices,
			hintsShown,
			firstAnswerCorrect,
			resolvedCorrect: false,
			phase: 'terminal',
			terminalOutcome: 'max_attempts'
		};
	}

	return {
		...state,
		answers,
		lockedChoices,
		hintsShown,
		firstAnswerCorrect,
		resolvedCorrect: null,
		phase: 'hinted',
		terminalOutcome: null
	};
}
