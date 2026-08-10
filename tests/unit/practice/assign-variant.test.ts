import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isMultiAttemptExperimentEnabled: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	limit: vi.fn(),
	insert: vi.fn(),
	values: vi.fn(),
	onConflictDoUpdate: vi.fn()
}));

vi.mock('$lib/flags', () => ({
	isMultiAttemptExperimentEnabled: mocks.isMultiAttemptExperimentEnabled
}));
vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		insert: mocks.insert
	})
}));

import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';

describe('getOrAssignMultiAttemptVariant', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isMultiAttemptExperimentEnabled.mockResolvedValue(false);
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ limit: mocks.limit });
		mocks.limit.mockResolvedValue([]);
		mocks.insert.mockReturnValue({ values: mocks.values });
		mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.onConflictDoUpdate });
		mocks.onConflictDoUpdate.mockResolvedValue(undefined);
	});

	it('does not persist a control assignment while the experiment is disabled', async () => {
		await expect(getOrAssignMultiAttemptVariant('user-1')).resolves.toMatchObject({
			assigned: 'control',
			enabled: false,
			assignment: {
				key: 'multi_attempt_hints',
				version: 2,
				variant: 'control'
			}
		});
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it('returns an existing current-version assignment without rewriting it', async () => {
		mocks.limit.mockResolvedValueOnce([
			{ key: 'multi_attempt_hints', version: 2, variant: 'multi_attempt_hints' }
		]);

		await expect(getOrAssignMultiAttemptVariant('user-1')).resolves.toEqual({
			assigned: 'multi_attempt_hints',
			enabled: false,
			assignment: {
				key: 'multi_attempt_hints',
				version: 2,
				variant: 'multi_attempt_hints'
			}
		});
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it('persists a stable assignment with an atomic upsert when enabled', async () => {
		mocks.isMultiAttemptExperimentEnabled.mockResolvedValue(true);

		const result = await getOrAssignMultiAttemptVariant('user-1');

		expect(result.enabled).toBe(true);
		expect(['control', 'multi_attempt_hints']).toContain(result.assigned);
		expect(mocks.insert).toHaveBeenCalledOnce();
		expect(mocks.values).toHaveBeenCalledWith({
			userId: 'user-1',
			...result.assignment
		});
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith({
			target: expect.any(Array),
			set: {
				version: 2,
				variant: result.assigned,
				updatedAt: expect.any(Date)
			}
		});
	});

	it('writes the current experiment version when no current assignment exists', async () => {
		mocks.isMultiAttemptExperimentEnabled.mockResolvedValue(true);

		const result = await getOrAssignMultiAttemptVariant('user-1');

		expect(result.assignment.version).toBe(2);
		expect(mocks.values).toHaveBeenCalledWith({
			userId: 'user-1',
			key: 'multi_attempt_hints',
			version: 2,
			variant: result.assigned
		});
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledOnce();
	});
});
