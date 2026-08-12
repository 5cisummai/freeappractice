import type { GeneratedQuestion } from '$lib/questions/types';

export const PENDING_SHARED_QUIZ_STORAGE_KEY = 'freeap_pending_shared_quiz';
const MAX_PENDING_SHARED_QUIZ_RUNS = 5;

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
	items: Array<{
		position: number;
		questionId: string;
		selectedAnswer: string | null;
		timeTakenMs: number | null;
	}>;
};

function parsePendingSharedQuizRun(value: unknown): PendingSharedQuizRun | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<PendingSharedQuizRun>;
	if (
		typeof candidate.quizId !== 'string' ||
		typeof candidate.sharedSlug !== 'string' ||
		typeof candidate.apClass !== 'string' ||
		typeof candidate.unit !== 'string' ||
		typeof candidate.startedAt !== 'string' ||
		!Array.isArray(candidate.items)
	) {
		return null;
	}
	return candidate as PendingSharedQuizRun;
}

export function readPendingSharedQuizRuns(): PendingSharedQuizRun[] {
	if (typeof localStorage === 'undefined') return [];
	const raw = localStorage.getItem(PENDING_SHARED_QUIZ_STORAGE_KEY);
	if (!raw) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		const candidates = Array.isArray(parsed) ? parsed : [parsed];
		const seenQuizIds = new Set<string>();
		return candidates
			.map(parsePendingSharedQuizRun)
			.filter((run): run is PendingSharedQuizRun => {
				if (!run || seenQuizIds.has(run.quizId)) return false;
				seenQuizIds.add(run.quizId);
				return true;
			})
			.slice(0, MAX_PENDING_SHARED_QUIZ_RUNS);
	} catch {
		return [];
	}
}

export function savePendingSharedQuizRun(run: PendingSharedQuizRun): void {
	if (typeof localStorage === 'undefined') return;
	const runs = [
		run,
		...readPendingSharedQuizRuns().filter((item) => item.quizId !== run.quizId)
	].slice(0, MAX_PENDING_SHARED_QUIZ_RUNS);
	localStorage.setItem(PENDING_SHARED_QUIZ_STORAGE_KEY, JSON.stringify(runs));
}

export function readPendingSharedQuizRun(): PendingSharedQuizRun | null {
	return readPendingSharedQuizRuns()[0] ?? null;
}

export function removePendingSharedQuizRun(quizId: string): void {
	if (typeof localStorage === 'undefined') return;
	const remaining = readPendingSharedQuizRuns().filter((run) => run.quizId !== quizId);
	if (remaining.length === 0) {
		localStorage.removeItem(PENDING_SHARED_QUIZ_STORAGE_KEY);
		return;
	}
	localStorage.setItem(PENDING_SHARED_QUIZ_STORAGE_KEY, JSON.stringify(remaining));
}

export function clearPendingSharedQuizRun(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(PENDING_SHARED_QUIZ_STORAGE_KEY);
}
