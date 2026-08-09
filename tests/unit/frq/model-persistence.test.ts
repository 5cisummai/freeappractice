import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	frqMaterials,
	frqRubricCriteria,
	frqRubricLevels,
	frqSections,
	frqQuestions,
	frqAttemptCriterionGrades,
	frqAttemptGrades,
	frqAttempts,
	questionRecentTopics,
	questionRegistry
} from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => {
	const questionRow = {
		questionId: 'frq-1',
		apClass: 'AP Biology',
		unit: 'Unit 4',
		formatId: 'scientific-analysis',
		profileVersion: 'biology-v1',
		promptVersion: 'frq-v1',
		rubricVersion: 'rubric-v1',
		schemaVersion: 1,
		prompt: 'Analyze the original scenario.',
		totalPoints: 2,
		topicsCovered: 'Cell signaling',
		contentHash: 'hash-1',
		randomKey: 0.5,
		active: true,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	};

	return {
		batch: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		select: vi.fn(),
		find: vi.fn(),
		findOne: vi.fn(),
		attemptFind: vi.fn(),
		questionRow,
		writeQueries: [] as Array<Record<string, unknown>>
	};
});

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		insert: mocks.insert,
		update: mocks.update,
		delete: mocks.delete,
		select: mocks.select
	})
}));

vi.mock('$lib/server/neon/model', () => ({
	model: (options: { idField: string }) =>
		options.idField === 'questionId'
			? { find: mocks.find, findOne: mocks.findOne }
			: { find: mocks.attemptFind },
	PostgresQuery: class {
		constructor(private readonly run: (options: unknown) => unknown) {}

		exec(options?: unknown) {
			return this.run(options ?? {});
		}
	},
	applyProjection: (document: unknown) => document
}));

import { FrqAttempt, FrqQuestionModel } from '$lib/frq/model.server';

function createQuery(kind: string, table: unknown) {
	const query: Record<string, unknown> = { kind, table };
	mocks.writeQueries.push(query);
	return query;
}

function configureDatabase() {
	mocks.writeQueries.length = 0;
	mocks.batch.mockImplementation(async (queries: Array<Record<string, unknown>>) => queries);
	mocks.insert.mockImplementation((table: unknown) => {
		const query = createQuery('insert', table);
		query.values = (values: unknown) => {
			query.valuesArg = values;
			return query;
		};
		query.onConflictDoUpdate = (config: unknown) => {
			query.conflict = 'update';
			query.conflictArg = config;
			return query;
		};
		query.onConflictDoNothing = () => {
			query.conflict = 'nothing';
			return query;
		};
		return query;
	});
	mocks.delete.mockImplementation((table: unknown) => {
		const query = createQuery('delete', table);
		query.where = (condition: unknown) => {
			query.whereArg = condition;
			return query;
		};
		return query;
	});
	mocks.update.mockImplementation((table: unknown) => {
		const query = createQuery('update', table);
		query.set = (values: unknown) => {
			query.valuesArg = values;
			return query;
		};
		query.where = (condition: unknown) => {
			query.whereArg = condition;
			return query;
		};
		return query;
	});
	mocks.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(mocks.questionRow) });
	mocks.find.mockReturnValue({ exec: vi.fn().mockResolvedValue([mocks.questionRow]) });
	mocks.select.mockImplementation(() => ({
		from: (table: unknown) => ({
			where: () => ({
				orderBy: vi.fn().mockResolvedValue(
					table === frqMaterials
						? [
								{
									questionId: 'frq-1',
									materialId: 'material-1',
									title: 'Results',
									content: 'A: 2',
									position: 0
								}
							]
						: table === frqSections
							? [
									{
										questionId: 'frq-1',
										sectionId: 'a',
										label: 'A',
										prompt: 'Explain the result.',
										responseKind: 'text',
										maxPoints: 2,
										position: 0
									}
								]
							: table === frqRubricCriteria
								? [
										{
											questionId: 'frq-1',
											criterionId: 'criterion-1',
											sectionId: 'a',
											label: 'Reasoning',
											maxPoints: 2,
											referenceAnswer: 'A correct explanation.',
											position: 0
										}
									]
								: table === frqRubricLevels
									? [
											{
												questionId: 'frq-1',
												criterionId: 'criterion-1',
												points: 0,
												description: 'No answer.',
												position: 0
											},
											{
												questionId: 'frq-1',
												criterionId: 'criterion-1',
												points: 2,
												description: 'Complete answer.',
												position: 1
											}
										]
									: []
				)
			})
		})
	}));
}

function createInput() {
	return {
		questionId: 'frq-1',
		apClass: 'AP Biology',
		unit: 'Unit 4',
		formatId: 'scientific-analysis',
		profileVersion: 'biology-v1',
		promptVersion: 'frq-v1',
		rubricVersion: 'rubric-v1',
		schemaVersion: 1 as const,
		prompt: 'Analyze the original scenario.',
		materials: [{ id: 'material-1', title: 'Results', content: 'A: 2' }],
		sections: [
			{
				id: 'a',
				label: 'A',
				prompt: 'Explain the result.',
				responseKind: 'text' as const,
				maxPoints: 2
			}
		],
		rubric: [
			{
				id: 'criterion-1',
				sectionId: 'a',
				label: 'Reasoning',
				maxPoints: 2,
				referenceAnswer: 'A correct explanation.',
				levels: [
					{ points: 0, description: 'No answer.' },
					{ points: 2, description: 'Complete answer.' }
				]
			}
		],
		totalPoints: 2,
		topicsCovered: 'Cell signaling',
		contentHash: 'hash-1',
		randomKey: 0.5,
		active: true,
		createdAt: mocks.questionRow.createdAt,
		updatedAt: mocks.questionRow.updatedAt
	};
}

describe('FrqQuestionModel.create persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('batches the registry, parent, and every child replacement before hydrating', async () => {
		const result = await FrqQuestionModel.create(createInput());
		const [queries] = mocks.batch.mock.calls[0] as [Array<Record<string, unknown>>];

		expect(mocks.batch).toHaveBeenCalledOnce();
		expect(queries).toHaveLength(11);
		expect(queries.slice(0, 2).map((query) => query.table)).toEqual([
			questionRegistry,
			frqQuestions
		]);
		expect(queries.slice(2, 6).map((query) => query.kind)).toEqual([
			'delete',
			'delete',
			'delete',
			'delete'
		]);
		expect(queries.slice(6).map((query) => query.table)).toEqual([
			frqMaterials,
			frqSections,
			frqRubricCriteria,
			frqRubricLevels,
			questionRecentTopics
		]);
		expect(queries[0]).toMatchObject({ conflict: 'update' });
		expect(queries[1]).toMatchObject({ conflict: 'update' });
		expect(mocks.writeQueries).toHaveLength(11);
		expect(result.materials).toEqual([{ id: 'material-1', title: 'Results', content: 'A: 2' }]);
		expect(result.sections[0]).toMatchObject({ id: 'a', label: 'A', maxPoints: 2 });
		expect(result.rubric[0]).toMatchObject({ id: 'criterion-1', sectionId: 'a' });
		expect(result.rubric[0].levels).toEqual([
			{ points: 0, description: 'No answer.' },
			{ points: 2, description: 'Complete answer.' }
		]);
	});

	it('keeps duplicate conflict behavior inside the same batch', async () => {
		await FrqQuestionModel.create(createInput());
		const [queries] = mocks.batch.mock.calls[0] as [Array<Record<string, unknown>>];

		expect(queries[0]).toMatchObject({
			conflict: 'update',
			conflictArg: expect.objectContaining({ set: expect.objectContaining({ kind: 'frq' }) })
		});
		expect(queries[1]).toMatchObject({ conflict: 'update' });
		expect(mocks.batch.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.findOne.mock.invocationCallOrder[0]
		);
	});
});

describe('FrqAttempt hydration and persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('hydrates a result set with two child queries and saves grading atomically', async () => {
		const createdAt = new Date('2026-01-02T00:00:00.000Z');
		const attempts = ['attempt-1', 'attempt-2'].map((id) => ({
			_id: id,
			userId: 'user-1',
			submissionId: `submission-${id}`,
			questionId: 'frq-1',
			apClass: 'AP Biology',
			unit: 'Unit 4',
			formatId: 'scientific-analysis',
			responses: { a: 'Response' },
			status: 'graded',
			timeTakenMs: 1_000,
			profileVersion: 'biology-v1',
			rubricVersion: 'rubric-v1',
			promptVersion: 'frq-v1',
			gradingModel: 'model-1',
			createdAt,
			updatedAt: createdAt
		}));
		mocks.attemptFind.mockReturnValue({ exec: vi.fn().mockResolvedValue(attempts) });
		mocks.select.mockImplementation(() => ({
			from: (table: unknown) => ({
				where: vi.fn().mockResolvedValue(
					table === frqAttemptGrades
						? [
								{
									attemptId: 'attempt-1',
									pointsEarned: 1,
									pointsAvailable: 2,
									percentage: 50,
									overallFeedback: 'Keep practicing.'
								}
							]
						: table === frqAttemptCriterionGrades
							? [
									{
										attemptId: 'attempt-1',
										criterionId: 'criterion-1',
										sectionId: 'a',
										label: 'Reasoning',
										points: 1,
										pointsAvailable: 2,
										evidence: 'Evidence',
										feedback: 'Feedback'
									}
								]
							: []
				)
			})
		}));

		const result = await FrqAttempt.find({ userId: 'user-1' }).exec();

		expect(mocks.select).toHaveBeenCalledTimes(2);
		expect(result[0].grade?.percentage).toBe(50);
		expect(result[1].grade).toBeUndefined();

		await result[0].save();
		const [writes] = mocks.batch.mock.calls[0] as [Array<Record<string, unknown>>];
		expect(writes).toHaveLength(5);
		expect(writes.map((query) => query.table)).toEqual([
			frqAttempts,
			frqAttemptGrades,
			frqAttemptCriterionGrades,
			frqAttemptGrades,
			frqAttemptCriterionGrades
		]);
	});
});

describe('FrqQuestionModel.find hydration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('hydrates every question with four bounded child queries', async () => {
		const secondQuestion = {
			...mocks.questionRow,
			questionId: 'frq-2',
			prompt: 'Analyze the second scenario.'
		};
		mocks.find.mockReturnValue({
			exec: vi.fn().mockResolvedValue([mocks.questionRow, secondQuestion])
		});
		mocks.select.mockImplementation(() => ({
			from: (table: unknown) => ({
				where: () => ({
					orderBy: vi.fn().mockResolvedValue(
						table === frqMaterials
							? [
									{ questionId: 'frq-1', materialId: 'm1', content: 'One', position: 0 },
									{ questionId: 'frq-2', materialId: 'm2', content: 'Two', position: 0 }
								]
							: table === frqSections || table === frqRubricCriteria || table === frqRubricLevels
								? []
								: []
					)
				})
			})
		}));

		const result = await FrqQuestionModel.find({ active: true }).exec();

		expect(mocks.select).toHaveBeenCalledTimes(4);
		expect(result).toHaveLength(2);
		expect(result[0].materials).toEqual([{ id: 'm1', title: undefined, content: 'One' }]);
		expect(result[1].materials).toEqual([{ id: 'm2', title: undefined, content: 'Two' }]);
	});
});
