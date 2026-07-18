import type { PracticeVariant, TerminalOutcome } from '$lib/practice/multi-attempt';

export interface IProgress {
	apClass: string;
	unit: string;
	completed: boolean;
	mastery: number;
	totalAttempts: number;
	correctAttempts: number;
	lastAttemptAt?: Date;
	lastReviewedAt?: Date;
}

export interface IPracticeExperimentAssignment {
	key: string;
	version: number;
	variant: PracticeVariant;
}

export interface IQuestionAttempt {
	questionId: string;
	apClass: string;
	unit: string;
	/** First-answer letter (stats/mastery source of truth). */
	selectedAnswer?: 'A' | 'B' | 'C' | 'D';
	/** First-answer correctness (stats/mastery source of truth). */
	wasCorrect?: boolean;
	timeTakenMs?: number;
	attemptedAt: Date;
	/** Treatment resolution fields (optional; control attempts omit these). */
	finalAnswer?: 'A' | 'B' | 'C' | 'D';
	answerCount?: number;
	hintsShown?: number;
	terminalOutcome?: TerminalOutcome;
	experimentKey?: string;
	experimentVersion?: number;
	displayedVariant?: PracticeVariant;
}
