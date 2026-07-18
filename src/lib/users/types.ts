import type { PracticeVariant, TerminalOutcome } from '$lib/practice/multi-attempt';

export interface ProgressEntry {
	apClass: string;
	unit: string;
	totalAttempts: number;
	correctAttempts?: number;
	mastery: number;
	lastAttemptAt?: string;
	frqAttempts?: number;
	frqPointsEarned?: number;
	frqPointsAvailable?: number;
	frqAveragePercentage?: number;
	frqLastAttemptAt?: string;
}

export interface StatsData {
	overview: {
		totalQuestions: number;
		correctAnswers: number;
		accuracy: number;
		currentStreak: number;
		totalTimeHours: number;
		frqSubmissions: number;
		frqAveragePercentage: number;
		memberSince: string;
	};
	recentPerformance: {
		questionsLast7Days: number;
		accuracyLast7Days: number;
		frqSubmissionsLast7Days: number;
	};
	subjectBreakdown: Array<{
		subject: string;
		total: number;
		correct: number;
		accuracy: number;
		avgTimeSeconds: number;
		frqAttempts: number;
		frqAveragePercentage: number;
	}>;
}

export type QuestionAttempt = {
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer?: 'A' | 'B' | 'C' | 'D';
	wasCorrect?: boolean;
	timeTakenMs?: number;
	attemptedAt: string;
	finalAnswer?: 'A' | 'B' | 'C' | 'D';
	answerCount?: number;
	hintsShown?: number;
	terminalOutcome?: TerminalOutcome;
	experimentKey?: string;
	experimentVersion?: number;
	displayedVariant?: PracticeVariant;
};

export type StoredMcqQuestion = {
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

export type McqHistoryItem = {
	kind: 'mcq';
	attempt: QuestionAttempt;
	question: StoredMcqQuestion | null;
};

export type FrqHistoryItem = {
	kind: 'frq';
	attempt: {
		id: string;
		questionId: string;
		apClass: string;
		unit: string;
		pointsEarned: number;
		pointsAvailable: number;
		percentage: number;
		timeTakenMs: number;
		attemptedAt: string;
	};
	question: null;
};

export type HistoryItem = McqHistoryItem | FrqHistoryItem;

export type HistoryResponse = {
	items: HistoryItem[];
	total: number;
	page: number;
	limit: number;
};
