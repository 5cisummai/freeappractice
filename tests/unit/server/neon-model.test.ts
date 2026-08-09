import { beforeEach, describe, expect, it, vi } from 'vitest';
import { poolGenerationBudgets } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	selectRows: [] as unknown[][],
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	returningInsert: vi.fn(),
	returningUpdate: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		insert: mocks.insert,
		update: mocks.update
	})
}));

import { model } from '$lib/server/neon/model';

function configureDatabase(): void {
	mocks.select.mockImplementation(() => ({
		from: () => ({
			where: () => ({ limit: async () => mocks.selectRows.shift() ?? [] })
		})
	}));
	mocks.insert.mockReturnValue({
		values: () => ({ returning: mocks.returningInsert })
	});
	mocks.update.mockReturnValue({
		set: () => ({ where: () => ({ returning: mocks.returningUpdate }) })
	});
}

describe('Neon compatibility model safety', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectRows = [];
		configureDatabase();
	});

	it('recovers when a concurrent upsert inserts the row first', async () => {
		mocks.selectRows = [[], [{ dayKey: '2026-08-09', generations: 2 }]];
		mocks.returningInsert.mockRejectedValueOnce({ code: '23505' });
		mocks.returningUpdate.mockResolvedValueOnce([{ dayKey: '2026-08-09', generations: 3 }]);
		const Budget = model<Record<string, unknown>>({
			table: poolGenerationBudgets as never,
			columns: poolGenerationBudgets as never,
			idField: 'dayKey'
		});

		const result = await Budget.findOneAndUpdate(
			{ dayKey: '2026-08-09' },
			{ $setOnInsert: { generations: 0 }, $inc: { generations: 1 } },
			{ upsert: true, returnDocument: 'after' }
		).exec();

		expect(result?.generations).toBe(3);
		expect(mocks.update).toHaveBeenCalledOnce();
	});

	it('fails loudly for an update field that has no mapped column', async () => {
		mocks.selectRows = [[{ dayKey: '2026-08-09', generations: 2 }]];
		const Budget = model<Record<string, unknown>>({
			table: poolGenerationBudgets as never,
			columns: poolGenerationBudgets as never,
			idField: 'dayKey'
		});

		await expect(
			Budget.findOneAndUpdate(
				{ dayKey: '2026-08-09' },
				{ $set: { 'report.narrative': 'lost before this guard' } }
			).exec()
		).rejects.toThrow('Unsupported PostgreSQL update field: report.narrative');
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
