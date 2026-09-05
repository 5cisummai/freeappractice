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
	recentDelta?: number;
	recentMistakes?: number;
	topics?: MasteryTopic[];
}

export interface MasteryTopic {
	name: string;
	attempts: number;
	correctAttempts: number;
	mastery: number | null;
	lastAttemptAt?: string;
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
	selectedAnswer: 'A' | 'B' | 'C' | 'D';
	wasCorrect: boolean;
	timeTakenMs?: number;
	attemptedAt: string;
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
	mainTopic?: string;
	topicsCovered?: string;
	diagramSpec?: Record<string, unknown>;
	hasDiagram?: boolean;
	stimulus?: {
		text: string | null;
		diagramSpec: Record<string, unknown> | null;
		provenance: 'ai-generated-original' | 'legacy-unknown';
	} | null;
	stimulusId?: string | null;
	stimulusPosition?: number | null;
	stimulusQuestionCount?: number | null;
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

export type QuizHistoryItem = {
	kind: 'quiz';
	attempt: {
		id: string;
		questionId: string;
		apClass: string;
		unit: string;
		requestedCount: number;
		answeredCount: number;
		correctCount: number;
		incorrectCount: number;
		scorePercent: number;
		timeTakenMs: number;
		attemptedAt: string;
	};
	question: null;
};

export type HistoryItem = McqHistoryItem | FrqHistoryItem | QuizHistoryItem;

export type HistorySummary = {
	total: number;
	answered: number;
	correct: number;
	accuracy: number | null;
	avgTimeMs: number | null;
};

export type HistoryResponse = {
	items: HistoryItem[];
	total: number;
	page: number;
	limit: number;
	summary: HistorySummary;
};
