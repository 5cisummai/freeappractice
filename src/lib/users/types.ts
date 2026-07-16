export interface ProgressEntry {
	apClass: string;
	unit: string;
	totalAttempts: number;
	correctAttempts?: number;
	mastery: number;
	lastAttemptAt?: string;
}

export interface StatsData {
	overview: {
		totalQuestions: number;
		correctAnswers: number;
		accuracy: number;
		currentStreak: number;
		totalTimeHours: number;
		memberSince: string;
	};
	recentPerformance: {
		questionsLast7Days: number;
		accuracyLast7Days: number;
	};
	subjectBreakdown: Array<{
		subject: string;
		total: number;
		correct: number;
		accuracy: number;
		avgTimeSeconds: number;
	}>;
}

type QuestionAttempt = {
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer: 'A' | 'B' | 'C' | 'D';
	wasCorrect: boolean;
	timeTakenMs?: number;
	attemptedAt: string;
	finalAnswer?: 'A' | 'B' | 'C' | 'D';
	answerCount?: number;
	hintsShown?: number;
	terminalOutcome?: 'correct' | 'revealed' | 'max_attempts';
	experimentKey?: string;
	experimentVersion?: number;
	displayedVariant?: 'control' | 'multi_attempt_hints';
};

type StoredMcqQuestion = {
	id: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	apClass?: string;
	unit?: string;
	createdAt: string;
};

export type HistoryItem = {
	attempt: QuestionAttempt;
	question: StoredMcqQuestion | null;
};

export type HistoryResponse = {
	items: HistoryItem[];
	total: number;
	page: number;
	limit: number;
};
