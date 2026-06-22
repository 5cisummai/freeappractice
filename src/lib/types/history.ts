type QuestionAttempt = {
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer: 'A' | 'B' | 'C' | 'D';
	wasCorrect: boolean;
	timeTakenMs?: number;
	attemptedAt: string;
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
