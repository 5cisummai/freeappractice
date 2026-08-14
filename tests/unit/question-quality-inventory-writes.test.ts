import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ execute: mocks.execute })
}));

import {
	syncQuestionMetadata,
	updateQuestionRegistryMetadata,
	upsertQuestionInventory
} from '$lib/question-quality/inventory-writes.server';

function staticSql(statement: { queryChunks: unknown[] }): string {
	return statement.queryChunks
		.filter(
			(chunk): chunk is { value: string[] } =>
				typeof chunk === 'object' &&
				chunk !== null &&
				'value' in chunk &&
				Array.isArray((chunk as { value?: unknown }).value)
		)
		.map((chunk) => chunk.value.join(''))
		.join('');
}

describe('question quality inventory writes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.execute.mockResolvedValue({ rows: [] });
	});

	it('upserts a group of inventory rows in one set-based statement', async () => {
		await upsertQuestionInventory([
			{
				questionId: 'q-1',
				questionCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
				contentLength: 120
			},
			{
				questionId: 'q-2',
				questionCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
				contentLength: 240
			}
		]);

		expect(mocks.execute).toHaveBeenCalledOnce();
		const statement = mocks.execute.mock.calls[0][0] as { queryChunks: unknown[] };
		const query = staticSql(statement);
		expect(query).toContain('jsonb_to_recordset');
		expect(query).toContain('ON CONFLICT');
		expect(statement.queryChunks).toContain(
			JSON.stringify([
				{
					questionId: 'q-1',
					kind: 'mcq',
					questionCreatedAt: '2026-08-01T00:00:00.000Z',
					contentLength: 120
				},
				{
					questionId: 'q-2',
					kind: 'mcq',
					questionCreatedAt: '2026-08-02T00:00:00.000Z',
					contentLength: 240
				}
			])
		);
	});

	it('updates registry and quality source metadata together for a hydrated group', async () => {
		await syncQuestionMetadata([
			{
				questionId: 'q-1',
				apClass: 'AP Biology',
				unit: 'Unit 1',
				questionCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
				contentHash: 'hash-1',
				contentLength: 400
			}
		]);

		expect(mocks.execute).toHaveBeenCalledOnce();
		const query = staticSql(mocks.execute.mock.calls[0][0]);
		expect(query).toContain('updated_registry AS');
		expect(query).toContain('UPDATE');
		expect(query).toContain('source_hash');
		expect(query).toContain('metadata_synced_at');
	});

	it('updates one registry row without rewriting quality state', async () => {
		await updateQuestionRegistryMetadata({
			questionId: 'q-1',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			questionCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
			contentHash: 'hash-1',
			contentLength: 400
		});

		expect(mocks.execute).toHaveBeenCalledOnce();
		const query = staticSql(mocks.execute.mock.calls[0][0]);
		expect(query).toContain('UPDATE');
		expect(query).not.toContain('source_hash');
	});
});
