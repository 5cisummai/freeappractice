import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PENDING_SHARED_QUIZ_STORAGE_KEY,
	readPendingSharedQuizRuns,
	savePendingSharedQuizRun
} from '$lib/shared-practice/pending-runs';
import type { PendingSharedQuizRun } from '$lib/shared-practice/types';

function createStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

function guestQuizRun(overrides: Partial<PendingSharedQuizRun> = {}): PendingSharedQuizRun {
	return {
		quizId: '11111111-1111-4111-8111-111111111111',
		apClass: 'AP World History',
		unit: 'Unit 1: The Global Tapestry',
		startedAt: '2026-09-20T12:00:00.000Z',
		retryCount: 0,
		items: [
			{
				position: 0,
				questionId: 'q-1',
				selectedAnswer: 'B',
				timeTakenMs: 4200
			}
		],
		...overrides
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('pending quiz runs', () => {
	it('persists a completed guest quiz without a shared slug', () => {
		const localStorage = createStorage();
		vi.stubGlobal('localStorage', localStorage);

		const run = guestQuizRun();
		expect(savePendingSharedQuizRun(run)).toBe(true);

		expect(JSON.parse(localStorage.getItem(PENDING_SHARED_QUIZ_STORAGE_KEY) ?? '[]')).toEqual([
			run
		]);
		expect(readPendingSharedQuizRuns()).toEqual([run]);
	});

	it('still restores shared-quiz runs stored with a slug', () => {
		const localStorage = createStorage();
		vi.stubGlobal('localStorage', localStorage);

		const run = guestQuizRun({ sharedSlug: 'apush-unit-1' });
		localStorage.setItem(PENDING_SHARED_QUIZ_STORAGE_KEY, JSON.stringify([run]));

		expect(readPendingSharedQuizRuns()).toEqual([run]);
	});

	it('ignores unreadable stored payloads', () => {
		const localStorage = createStorage();
		vi.stubGlobal('localStorage', localStorage);
		localStorage.setItem(PENDING_SHARED_QUIZ_STORAGE_KEY, '{not-json');

		expect(readPendingSharedQuizRuns()).toEqual([]);
	});
});
