import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	execute: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ execute: mocks.execute })
}));

import { getCurrentMcqStreaksForUsers, getCurrentStreak } from '$lib/users/streak.server';

const dialect = new PgDialect();

function compiledCall(index = 0) {
	const query = mocks.execute.mock.calls[index]?.[0] as SQL;
	return dialect.sqlToQuery(query);
}

describe('indexed current-streak queries', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-08T18:00:00.000Z'));
	});

	it('uses recursive bounded day probes for a single user and includes FRQ activity when requested', async () => {
		mocks.execute.mockResolvedValueOnce({ rows: [{ streak: '7' }] });

		await expect(getCurrentStreak('user-1', 'America/Los_Angeles', true)).resolves.toBe(7);

		const { sql, params } = compiledCall();
		expect(sql).toContain('WITH RECURSIVE');
		expect(sql).toContain('"mcq_attempts"."attempted_at" >=');
		expect(sql).toContain('"mcq_attempts"."attempted_at" <');
		expect(sql).toContain('"frq_attempts"."created_at" >=');
		expect(sql).toContain('"frq_attempts"."status" = \'graded\'');
		expect(sql).not.toContain('SELECT DISTINCT');
		expect(params).toContain('user-1');
		expect(params).toContain('America/Los_Angeles');
		expect(params).toContain('2026-09-08');
	});

	it('computes group streaks in one recursive query and normalizes numeric results', async () => {
		mocks.execute.mockResolvedValueOnce({
			rows: [
				{ userId: 'user-1', currentStreak: '3' },
				{ userId: 'user-2', currentStreak: 1 }
			]
		});

		await expect(getCurrentMcqStreaksForUsers(['user-1', 'user-2'], 'UTC')).resolves.toEqual([
			{ userId: 'user-1', currentStreak: 3 },
			{ userId: 'user-2', currentStreak: 1 }
		]);

		const { sql, params } = compiledCall();
		expect(sql).toContain('WITH RECURSIVE requested_users(user_id)');
		expect(sql).toContain('VALUES ($1::text), ($2::text)');
		expect(sql).toContain('GROUP BY user_id');
		expect(sql).not.toContain('SELECT DISTINCT');
		expect(params.slice(0, 2)).toEqual(['user-1', 'user-2']);
	});

	it('skips the database for an empty group', async () => {
		await expect(getCurrentMcqStreaksForUsers([], 'UTC')).resolves.toEqual([]);
		expect(mocks.execute).not.toHaveBeenCalled();
	});
});
