export interface IProgress {
	apClass: string;
	unit: string;
	completed: boolean;
	mastery: number;
	totalAttempts: number;
	correctAttempts: number;
	lastAttemptAt?: Date;
	lastReviewedAt?: Date;
	frqTotalAttempts: number;
	frqTotalScore: number;
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

export interface IFRQAttempt {
	questionId: string;
	apClass: string;
	unit: string;
	aiScore: number;
	pointsEarned: number;
	totalPoints: number;
	timeTakenMs?: number;
	attemptedAt: Date;
}
