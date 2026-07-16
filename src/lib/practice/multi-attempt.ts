export const MULTI_ATTEMPT_EXPERIMENT_KEY = 'multi_attempt_hints';
export const MULTI_ATTEMPT_EXPERIMENT_VERSION = 1;
export const MAX_MULTI_ATTEMPT_SUBMISSIONS = 3;

export type PracticeVariant = 'control' | 'multi_attempt_hints';

export type TerminalOutcome = 'correct' | 'revealed' | 'max_attempts';

export type FallbackReason = 'none' | 'missing_hints' | 'experiment_disabled';

export type PracticeExperimentAssignment = {
	key: string;
	version: number;
	variant: PracticeVariant;
};

const ANSWER_CHOICES = new Set(['A', 'B', 'C', 'D']);

export function hasValidHints(question: { hint1?: string | null; hint2?: string | null }): boolean {
	return Boolean(question.hint1?.trim() && question.hint2?.trim());
}

/** Classic clients omit answers/displayedVariant; keep them on the legacy record-attempt path. */
export function isMultiAttemptRequestBody(body: Record<string, unknown>): boolean {
	return Array.isArray(body.answers) || body.displayedVariant === 'multi_attempt_hints';
}

/** True when a client is participating in the server-owned experiment contract. */
export function hasPracticeExperimentMetadata(body: Record<string, unknown>): boolean {
	return (
		Array.isArray(body.answers) ||
		body.displayedVariant !== undefined ||
		body.experimentKey !== undefined ||
		body.experimentVersion !== undefined
	);
}

export function resolveDisplayedVariant(input: {
	assigned: PracticeVariant;
	experimentEnabled: boolean;
	questionHasHints: boolean;
}): { displayed: PracticeVariant; fallbackReason: FallbackReason } {
	if (!input.experimentEnabled) {
		return { displayed: 'control', fallbackReason: 'experiment_disabled' };
	}
	if (input.assigned === 'control') {
		return { displayed: 'control', fallbackReason: 'none' };
	}
	if (!input.questionHasHints) {
		return { displayed: 'control', fallbackReason: 'missing_hints' };
	}
	return { displayed: 'multi_attempt_hints', fallbackReason: 'none' };
}

export function normalizeAnswerLetter(value: unknown): 'A' | 'B' | 'C' | 'D' | null {
	if (typeof value !== 'string') return null;
	const letter = value.trim().toUpperCase();
	return ANSWER_CHOICES.has(letter) ? (letter as 'A' | 'B' | 'C' | 'D') : null;
}

export type MultiAttemptPayload = {
	answers: Array<'A' | 'B' | 'C' | 'D'>;
	terminalOutcome: TerminalOutcome;
	hintsShown: number;
	displayedVariant: PracticeVariant;
	experimentKey: string;
	experimentVersion: number;
};

type ValidatedMultiAttemptInput = Omit<MultiAttemptPayload, 'experimentKey' | 'experimentVersion'>;

export function validateMultiAttemptPayload(
	body: Record<string, unknown>,
	correctAnswer: 'A' | 'B' | 'C' | 'D'
): { ok: true; data: ValidatedMultiAttemptInput } | { ok: false; error: string } {
	const answersRaw = body.answers;
	const terminalOutcome = body.terminalOutcome;
	if (
		terminalOutcome !== 'correct' &&
		terminalOutcome !== 'revealed' &&
		terminalOutcome !== 'max_attempts'
	) {
		return { ok: false, error: 'Invalid terminalOutcome' };
	}
	if (
		!Array.isArray(answersRaw) ||
		answersRaw.length > MAX_MULTI_ATTEMPT_SUBMISSIONS ||
		(answersRaw.length < 1 && terminalOutcome !== 'revealed')
	) {
		return { ok: false, error: 'answers must contain 1 to 3 letters' };
	}

	const answers: Array<'A' | 'B' | 'C' | 'D'> = [];
	const seenWrong = new Set<string>();
	for (const entry of answersRaw) {
		const letter = normalizeAnswerLetter(entry);
		if (!letter) return { ok: false, error: 'Each answer must be A, B, C, or D' };
		if (seenWrong.has(letter)) {
			return { ok: false, error: 'Cannot repeat a previously incorrect choice' };
		}
		answers.push(letter);
		if (letter !== correctAnswer) seenWrong.add(letter);
	}

	const last = answers[answers.length - 1]!;
	if (terminalOutcome === 'correct' && last !== correctAnswer) {
		return { ok: false, error: 'correct outcome requires a final correct answer' };
	}
	if (terminalOutcome !== 'correct' && last === correctAnswer) {
		return { ok: false, error: 'incorrect terminal outcomes cannot end on the correct answer' };
	}
	if (terminalOutcome === 'max_attempts' && answers.length !== MAX_MULTI_ATTEMPT_SUBMISSIONS) {
		return { ok: false, error: 'max_attempts requires three submissions' };
	}

	const hintsShown =
		typeof body.hintsShown === 'number' && Number.isInteger(body.hintsShown) ? body.hintsShown : -1;
	if (hintsShown < 0 || hintsShown > 2) {
		return { ok: false, error: 'hintsShown must be 0, 1, or 2' };
	}
	const expectedHintsShown = Math.min(
		2,
		answers.filter((answer) => answer !== correctAnswer).length
	);
	if (hintsShown !== expectedHintsShown) {
		return { ok: false, error: 'hintsShown does not match the submitted answers' };
	}

	const displayedVariant = body.displayedVariant;
	if (displayedVariant !== 'control' && displayedVariant !== 'multi_attempt_hints') {
		return { ok: false, error: 'Invalid displayedVariant' };
	}

	return {
		ok: true,
		data: {
			answers,
			terminalOutcome,
			hintsShown,
			displayedVariant
		}
	};
}

/** First-answer semantics for stats/mastery; treatment fields describe later resolution. */
export function buildAttemptFieldsFromMultiAttempt(
	payload: MultiAttemptPayload,
	correctAnswer: 'A' | 'B' | 'C' | 'D'
) {
	const firstAnswer = payload.answers[0];
	const finalAnswer = payload.answers[payload.answers.length - 1];
	return {
		selectedAnswer: firstAnswer,
		wasCorrect: firstAnswer ? firstAnswer === correctAnswer : undefined,
		finalAnswer,
		answerCount: payload.answers.length,
		hintsShown: payload.hintsShown,
		terminalOutcome: payload.terminalOutcome,
		experimentKey: payload.experimentKey,
		experimentVersion: payload.experimentVersion,
		displayedVariant: payload.displayedVariant
	};
}
