/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	frqAttempts,
	frqQuestions,
	questionRecentTopics,
	questionRegistry
} from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	db: {
		batch: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		select: vi.fn()
	},
	queries: [] as Array<Record<string, unknown>>,
	questionRow: {
		questionId: 'frq-1',
		data: {
			apClass: 'AP Biology',
			unit: 'Unit 4',
			formatId: 'short-conceptual-analysis',
			responseMode: 'parts',
			schemaVersion: 2,
			prompt: 'Analyze the scenario.',
			materials: [{ id: 'material-1', title: 'Results', content: 'A: 2' }],
			parts: [
				{
					id: 'A',
					label: 'A',
					prompt: 'Explain.',
					points: 1,
					earns: 'Award 1 for a complete explanation.',
					answer: 'A correct explanation.'
				}
			],
			mainTopic: 'Cell signaling',
			topicsCovered: 'Cell signaling'
		},
		contentHash: 'hash-1',
		randomKey: 0.5,
		active: true,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
}));

vi.mock('$lib/server/neon/db', () => ({ getNeonDatabase: () => mocks.db }));

function builder(kind: string, table: unknown) {
	const query: Record<string, any> = { kind, table };
	mocks.queries.push(query);
	query.values = vi.fn((value: unknown) => {
		query.valuesArg = value;
		return query;
	});
	query.set = vi.fn((value: unknown) => {
		query.valuesArg = value;
		return query;
	});
	query.where = vi.fn((condition: unknown) => {
		query.whereArg = condition;
		return query;
	});
	query.onConflictDoUpdate = vi.fn((config: unknown) => {
		query.conflictArg = config;
		return query;
	});
	query.returning = vi.fn(async () => []);
	return query;
}

function configureDatabase() {
	mocks.queries.length = 0;
	mocks.db.batch.mockResolvedValue(undefined);
	mocks.db.insert.mockImplementation((table: unknown) => builder('insert', table));
	mocks.db.update.mockImplementation((table: unknown) => builder('update', table));
	mocks.db.delete.mockImplementation((table: unknown) => builder('delete', table));
	mocks.db.select.mockImplementation(() => ({
		from: (table: unknown) => ({
			where: () => ({
				limit: async () => (table === frqQuestions ? [mocks.questionRow] : [])
			})
		})
	}));
}

vi.mock('$lib/server/neon/schema', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/neon/schema')>('$lib/server/neon/schema');
	return actual;
});

import { createFrqQuestion } from '$lib/question-bank/frq/model.server';
import { updateFrqAttemptGrade, type IFrqAttempt } from '$lib/grading/frq/storage.server';

const input = {
	questionId: 'frq-1',
	apClass: 'AP Biology',
	unit: 'Unit 4',
	formatId: 'short-conceptual-analysis',
	responseMode: 'parts' as const,
	schemaVersion: 2 as const,
	prompt: 'Analyze the scenario.',
	materials: [{ id: 'material-1', title: 'Results', content: 'A: 2' }],
	parts: [
		{
			id: 'A',
			label: 'A',
			prompt: 'Explain.',
			points: 1,
			earns: 'Award 1 for a complete explanation.',
			answer: 'A correct explanation.'
		}
	],
	mainTopic: 'Cell signaling',
	topicsCovered: 'Cell signaling',
	contentHash: 'hash-1',
	randomKey: 0.5,
	active: true
};

describe('direct FRQ persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('writes the registry and complete JSONB question in one Drizzle batch', async () => {
		const result = await createFrqQuestion(input);
		const [writes] = mocks.db.batch.mock.calls[0] as [Array<Record<string, unknown>>];

		expect(writes).toHaveLength(3);
		expect(writes.slice(0, 2).map((query) => query.table)).toEqual([
			questionRegistry,
			frqQuestions
		]);
		expect(writes[2]?.table).toBe(questionRecentTopics);
		expect(result.materials[0]).toEqual({ id: 'material-1', title: 'Results', content: 'A: 2' });
		expect(result.parts[0]?.answer).toBe('A correct explanation.');
	});

	it('stores the grade on the attempt row', async () => {
		const attempt = { id: 'attempt-1' } as IFrqAttempt;
		const grade = {
			parts: [
				{
					id: 'A',
					label: 'A',
					points: 1,
					pointsAvailable: 1,
					feedback: 'Complete.'
				}
			],
			pointsEarned: 1,
			pointsAvailable: 1,
			percentage: 100,
			overallFeedback: 'Keep practicing.'
		};
		await updateFrqAttemptGrade(attempt, grade, 'model-1');

		expect(mocks.db.batch).not.toHaveBeenCalled();
		expect(mocks.db.update).toHaveBeenCalledWith(frqAttempts);
		const update = mocks.queries.find(
			(query) => query.kind === 'update' && query.table === frqAttempts
		);
		expect(update?.valuesArg).toMatchObject({
			status: 'graded',
			gradingModel: 'model-1',
			pointsEarned: 1,
			pointsAvailable: 1,
			percentage: 100,
			grade
		});
	});
});
