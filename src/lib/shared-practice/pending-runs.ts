import type { PendingSharedQuizRun } from '$lib/shared-practice/types';

export const PENDING_SHARED_QUIZ_STORAGE_KEY = 'freeap_pending_shared_quiz';
const MAX_PENDING_SHARED_QUIZ_RUNS = 5;
const MAX_PENDING_SHARED_QUIZ_RETRIES = 3;

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
	return {
		...candidate,
		retryCount:
			typeof candidate.retryCount === 'number' && candidate.retryCount >= 0
				? Math.floor(candidate.retryCount)
				: 0
	} as PendingSharedQuizRun;
}

export function readPendingSharedQuizRuns(): PendingSharedQuizRun[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(PENDING_SHARED_QUIZ_STORAGE_KEY);
		if (!raw) return [];
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

function writePendingSharedQuizRuns(runs: PendingSharedQuizRun[]): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		if (runs.length === 0) localStorage.removeItem(PENDING_SHARED_QUIZ_STORAGE_KEY);
		else localStorage.setItem(PENDING_SHARED_QUIZ_STORAGE_KEY, JSON.stringify(runs));
		return true;
	} catch {
		return false;
	}
}

export function savePendingSharedQuizRun(run: PendingSharedQuizRun): boolean {
	const runs = [
		run,
		...readPendingSharedQuizRuns().filter((item) => item.quizId !== run.quizId)
	].slice(0, MAX_PENDING_SHARED_QUIZ_RUNS);
	return writePendingSharedQuizRuns(runs);
}

export function removePendingSharedQuizRun(quizId: string): void {
	writePendingSharedQuizRuns(readPendingSharedQuizRuns().filter((run) => run.quizId !== quizId));
}

export function recordPendingSharedQuizRunFailure(quizId: string): void {
	const runs = readPendingSharedQuizRuns().flatMap((run) => {
		if (run.quizId !== quizId) return [run];
		const retryCount = run.retryCount + 1;
		return retryCount >= MAX_PENDING_SHARED_QUIZ_RETRIES ? [] : [{ ...run, retryCount }];
	});
	writePendingSharedQuizRuns(runs);
}
