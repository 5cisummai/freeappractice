import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getQuestion: vi.fn(),
	getFrqQuestion: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/bank.server', () => ({ getQuestion: mocks.getQuestion }));
vi.mock('$lib/question-bank/frq/bank.server', () => ({ getFrqQuestion: mocks.getFrqQuestion }));

import { questionBank } from '$lib/question-bank/bank.server';

describe('questionBank request seam', () => {
	it('exposes named MCQ and FRQ banks without leaking their internals', () => {
		expect(questionBank.getBank('mcq').name).toBe('mcq');
		expect(questionBank.getBank('frq').name).toBe('frq');
	});

	it('routes MCQ requests through the selection adapter', async () => {
		mocks.getQuestion.mockResolvedValue({ status: 'warming', retryAfterSeconds: 1 });

		await expect(
			questionBank.get({ kind: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' })
		).resolves.toEqual({ kind: 'mcq', outcome: { status: 'warming', retryAfterSeconds: 1 } });
		expect(mocks.getQuestion).toHaveBeenCalledWith('AP Biology', 'Unit 1', undefined);
	});

	it('routes FRQ requests without exposing the FRQ pool to MCQ callers', async () => {
		mocks.getFrqQuestion.mockResolvedValue({ status: 'failed', error: new Error('offline') });

		await expect(
			questionBank.get({ kind: 'frq', apClass: 'AP Biology', unit: 'Unit 2', options: {} })
		).resolves.toMatchObject({ kind: 'frq', outcome: { status: 'failed' } });
		expect(mocks.getFrqQuestion).toHaveBeenCalledWith('AP Biology', 'Unit 2', {});
	});
});
