/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	frqAttemptCriterionGrades,
	frqAttemptGrades,
	frqAttempts,
	frqMaterials,
	frqQuestions,
	frqRubricCriteria,
	frqRubricLevels,
	frqSections,
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
		apClass: 'AP Biology',
		unit: 'Unit 4',
		formatId: 'scientific-analysis',
		profileVersion: 'biology-v1',
		promptVersion: 'frq-v1',
		rubricVersion: 'rubric-v1',
		schemaVersion: 1,
		prompt: 'Analyze the scenario.',
		totalPoints: 2,
		topicsCovered: 'Cell signaling',
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

function childRows(table: unknown) {
	if (table === frqMaterials)
		return [
			{
				questionId: 'frq-1',
				materialId: 'material-1',
				title: 'Results',
				content: 'A: 2',
				position: 0
			}
		];
	if (table === frqSections)
		return [
			{
				questionId: 'frq-1',
				sectionId: 'a',
				label: 'A',
				prompt: 'Explain.',
				responseKind: 'text',
				maxPoints: 2,
				position: 0
			}
		];
	if (table === frqRubricCriteria)
		return [
			{
				questionId: 'frq-1',
				criterionId: 'criterion-1',
				sectionId: 'a',
				label: 'Reasoning',
				maxPoints: 2,
				referenceAnswer: 'A correct explanation.',
				position: 0
			}
		];
	if (table === frqRubricLevels)
		return [
			{
				questionId: 'frq-1',
				criterionId: 'criterion-1',
				points: 2,
				description: 'Complete answer.',
				position: 0
			}
		];
	return [];
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
				limit: async () => (table === frqQuestions ? [mocks.questionRow] : []),
				orderBy: async () => childRows(table)
			})
		})
	}));
}

vi.mock('$lib/server/neon/schema', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/neon/schema')>('$lib/server/neon/schema');
	return actual;
});

import {
	createFrqQuestion,
	updateFrqAttemptGrade,
	type IFrqAttempt
} from '$lib/question-bank/frq/model.server';

const input = {
	questionId: 'frq-1',
	apClass: 'AP Biology',
	unit: 'Unit 4',
	formatId: 'scientific-analysis',
	profileVersion: 'biology-v1',
	promptVersion: 'frq-v1',
	rubricVersion: 'rubric-v1',
	schemaVersion: 1 as const,
	prompt: 'Analyze the scenario.',
	materials: [{ id: 'material-1', title: 'Results', content: 'A: 2' }],
	sections: [
		{ id: 'a', label: 'A', prompt: 'Explain.', responseKind: 'text' as const, maxPoints: 2 }
	],
	rubric: [
		{
			id: 'criterion-1',
			sectionId: 'a',
			label: 'Reasoning',
			maxPoints: 2,
			referenceAnswer: 'A correct explanation.',
			levels: [{ points: 2, description: 'Complete answer.' }]
		}
	],
	totalPoints: 2,
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

	it('writes the registry, parent, and child rows in one Drizzle batch', async () => {
		const result = await createFrqQuestion(input);
		const [writes] = mocks.db.batch.mock.calls[0] as [Array<Record<string, unknown>>];

		expect(writes).toHaveLength(11);
		expect(writes.slice(0, 2).map((query) => query.table)).toEqual([
			questionRegistry,
			frqQuestions
		]);
		expect(writes.slice(2, 6).map((query) => query.kind)).toEqual([
			'delete',
			'delete',
			'delete',
			'delete'
		]);
		expect(writes.slice(6).map((query) => query.table)).toEqual([
			frqMaterials,
			frqSections,
			frqRubricCriteria,
			frqRubricLevels,
			questionRecentTopics
		]);
		expect(result.materials[0]).toEqual({ id: 'material-1', title: 'Results', content: 'A: 2' });
		expect(result.rubric[0]?.levels).toEqual([{ points: 2, description: 'Complete answer.' }]);
	});

	it('updates grading rows atomically through Drizzle', async () => {
		const attempt = { id: 'attempt-1' } as IFrqAttempt;
		await updateFrqAttemptGrade(
			attempt,
			{
				pointsEarned: 1,
				pointsAvailable: 2,
				percentage: 50,
				overallFeedback: 'Keep practicing.',
				criteria: []
			},
			'model-1'
		);

		const [writes] = mocks.db.batch.mock.calls[0] as [Array<Record<string, unknown>>];
		expect(writes).toHaveLength(4);
		expect(writes.map((query) => query.table)).toEqual([
			frqAttempts,
			frqAttemptGrades,
			frqAttemptCriterionGrades,
			frqAttemptGrades
		]);
	});
});
