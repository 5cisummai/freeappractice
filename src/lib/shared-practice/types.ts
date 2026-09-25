import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';

export type SharedQuizView = {
	id: string;
	slug: string;
	title: string;
	kind: 'quiz';
	course: string;
	unit: string;
	itemCount: number;
	creatorName: string | null;
	expiresAt: string;
	questions: GeneratedQuestion[];
};

export type PendingSharedQuizRun = {
	quizId: string;
	sharedSlug?: string;
	course: string;
	unit: string;
	startedAt: string;
	retryCount: number;
	items: Array<{
		position: number;
		questionId: string;
		selectedAnswer: string | null;
		timeTakenMs: number | null;
	}>;
};
