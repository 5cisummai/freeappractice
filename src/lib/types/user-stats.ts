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
