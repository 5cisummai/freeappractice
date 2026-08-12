import type { GeneratedQuestion } from '$lib/questions/types';

export type SharedQuizView = {
	id: string;
	slug: string;
	title: string;
	kind: 'quiz';
	apClass: string;
	unit: string;
	itemCount: number;
	creatorName: string | null;
	expiresAt: string;
	questions: GeneratedQuestion[];
};

export type PendingSharedQuizRun = {
	quizId: string;
	sharedSlug: string;
	apClass: string;
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
