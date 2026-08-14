import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	database: {
		insert: vi.fn(),
		batch: vi.fn()
	}
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => mocks.database
}));

vi.mock('$lib/server/neon/schema', () => ({
	mcqQuestions: { name: 'mcqQuestions' },
	questionRecentTopics: { name: 'questionRecentTopics' },
	questionRegistry: { questionId: 'questionRegistry.questionId', name: 'questionRegistry' }
}));

import { createCanonicalMcqQuestion } from '$lib/questions/repository.server';

const sampleQuestion = {
	questionId: 'mcq-1',
	apClass: 'AP Biology',
	unit: 'Unit 1',
	contentHash: 'hash-1',
	topicsCovered: ' Cell signaling ',
	question: 'What is a receptor? ',
	optionA: 'A',
	optionB: 'B',
	optionC: 'C',
	optionD: 'D',
	correctAnswer: 'A' as const,
	explanation: 'Because.',
	hint1: 'Hint 1',
	hint2: 'Hint 2',
	randomKey: 0.42,
	active: true
};

function makeInsertBuilder(table: unknown) {
	const builder = {
		table,
		values: vi.fn(),
		onConflictDoUpdate: vi.fn(),
		returning: vi.fn()
	};
	builder.values.mockReturnValue(builder);
	builder.onConflictDoUpdate.mockReturnValue(builder);
	builder.returning.mockReturnValue({ kind: 'returning', source: builder });
	return builder;
}

describe('canonical MCQ persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.database.insert.mockImplementation((table: unknown) => makeInsertBuilder(table));
		mocks.database.batch.mockResolvedValue([
			[],
			[
				{
					questionId: sampleQuestion.questionId,
					apClass: sampleQuestion.apClass,
					unit: sampleQuestion.unit,
					contentHash: sampleQuestion.contentHash,
					question: sampleQuestion.question
				}
			],
			[]
		]);
	});

	it('writes registry, MCQ, and non-empty recent topic in one batch', async () => {
		const result = await createCanonicalMcqQuestion(sampleQuestion);

		expect(mocks.database.batch).toHaveBeenCalledOnce();
		const [queries] = mocks.database.batch.mock.calls[0] as [unknown[]];
		expect(queries).toHaveLength(3);

		const registry = queries[0] as ReturnType<typeof makeInsertBuilder>;
		const mcqReturning = queries[1] as { source: ReturnType<typeof makeInsertBuilder> };
		const recentTopic = queries[2] as ReturnType<typeof makeInsertBuilder>;

		expect(registry.table).toEqual({
			name: 'questionRegistry',
			questionId: 'questionRegistry.questionId'
		});
		expect(registry.values).toHaveBeenCalledWith(
			expect.objectContaining({ questionId: 'mcq-1', kind: 'mcq', contentLength: 20 })
		);
		expect(mcqReturning.source.values).toHaveBeenCalledWith(
			expect.objectContaining({ questionId: 'mcq-1', topicsCovered: 'Cell signaling' })
		);
		expect(recentTopic.values).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'mcq',
				apClass: 'AP Biology',
				unit: 'Unit 1',
				topicsCovered: 'Cell signaling',
				questionId: 'mcq-1'
			})
		);
		expect(result).toMatchObject({ questionId: 'mcq-1' });
	});

	it('keeps blank recent topics out of the batch', async () => {
		await createCanonicalMcqQuestion({ ...sampleQuestion, topicsCovered: '   ' });

		const [queries] = mocks.database.batch.mock.calls[0] as [unknown[]];
		expect(queries).toHaveLength(2);
		expect(mocks.database.insert).toHaveBeenCalledTimes(2);
	});

	it('propagates a duplicate failure from the atomic batch', async () => {
		const duplicate = { code: '23505' };
		mocks.database.batch.mockRejectedValueOnce(duplicate);

		await expect(createCanonicalMcqQuestion(sampleQuestion)).rejects.toBe(duplicate);
		expect(mocks.database.batch).toHaveBeenCalledOnce();
	});
});
