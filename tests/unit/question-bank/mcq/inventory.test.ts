import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getAllQuestions: vi.fn(),
	getQuestionById: vi.fn(),
	findFrqQuestionById: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/repository.server', () => ({
	getAllQuestions: mocks.getAllQuestions,
	getQuestionById: mocks.getQuestionById
}));
vi.mock('$lib/question-bank/frq/model.server', () => ({
	findFrqQuestionById: mocks.findFrqQuestionById
}));
vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: () => ({ from: () => [] }) })
}));

import { getQuestionInventory } from '$lib/question-bank/inventory.server';

describe('canonical question inventories', () => {
	beforeEach(() => vi.clearAllMocks());

	it('normalizes an MCQ behind the shared inventory shape', async () => {
		mocks.getQuestionById.mockResolvedValue({
			id: 'mcq-1',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			createdAt: '2026-08-01T00:00:00.000Z',
			contentHash: 'mcq-hash',
			question: 'Stem'
		});

		await expect(getQuestionInventory('mcq').get('mcq-1')).resolves.toMatchObject({
			kind: 'mcq',
			id: 'mcq-1',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			contentHash: 'mcq-hash',
			content: { question: 'Stem' }
		});
	});

	it('normalizes an FRQ without enabling automated quality review', async () => {
		mocks.findFrqQuestionById.mockResolvedValue({
			questionId: 'frq-1',
			apClass: 'AP Biology',
			unit: 'Unit 2',
			createdAt: new Date('2026-08-02T00:00:00.000Z'),
			contentHash: 'frq-hash',
			prompt: 'Explain'
		});

		await expect(getQuestionInventory('frq').get('frq-1')).resolves.toMatchObject({
			kind: 'frq',
			id: 'frq-1',
			apClass: 'AP Biology',
			unit: 'Unit 2',
			content: { prompt: 'Explain' }
		});
	});
});
