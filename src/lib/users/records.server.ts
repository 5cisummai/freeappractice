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

export type PracticeVariant = 'control' | 'multi_attempt_hints';
export type TerminalOutcome = 'correct' | 'revealed' | 'max_attempts';

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
