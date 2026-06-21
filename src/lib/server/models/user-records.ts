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

export interface IQuestionAttempt {
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer: 'A' | 'B' | 'C' | 'D';
	wasCorrect: boolean;
	timeTakenMs?: number;
	attemptedAt: Date;
}
