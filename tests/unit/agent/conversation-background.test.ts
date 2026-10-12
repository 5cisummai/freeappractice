import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => {
	const limit = vi.fn();
	const returning = vi.fn();
	const where = vi.fn();
	const set = vi.fn();
	const builder = { from: vi.fn(), where, orderBy: vi.fn(), limit, set, returning };
	builder.from.mockReturnValue(builder);
	where.mockReturnValue(builder);
	builder.orderBy.mockReturnValue(builder);
	set.mockReturnValue(builder);
	return {
		builder,
		limit,
		returning,
		where,
		set,
		select: vi.fn(() => builder),
		update: vi.fn(() => builder),
		generateText: vi.fn(),
		owned: vi.fn()
	};
});
vi.mock('ai', async (load) => ({
	...(await load<typeof import('ai')>()),
	generateText: mocks.generateText
}));
vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select, update: mocks.update })
}));
vi.mock('$lib/agent/conversations/store.server', async (load) => ({
	...(await load<typeof import('$lib/agent/conversations/store.server')>()),
	getOwnedConversation: mocks.owned
}));

import { summarizeConversation } from '$lib/agent/conversations/summary.server';
import { updateAutomaticTitle } from '$lib/agent/conversations/titles.server';
import {
	getAgentHistory,
	renameOwnedConversation,
	type OwnedConversation
} from '$lib/agent/conversations/store.server';

const dialect = new PgDialect();
function query(value: unknown) {
	return dialect.sqlToQuery(value as SQL);
}
const owned = {
	id: 'conversation-1',
	userId: 'user-1',
	context: { other: 'preserve' }
} as unknown as OwnedConversation;
const row = (position: number) => ({
	id: `message-${position}`,
	role: 'user',
	content: `Study goal ${position}`,
	parts: [],
	status: 'complete',
	position
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.owned.mockResolvedValue(owned);
	mocks.limit.mockResolvedValue([row(10)]);
	mocks.returning.mockResolvedValue([{ id: owned.id, title: 'Manual title' }]);
	mocks.generateText.mockResolvedValue({ text: 'Saved study goals', usage: {} });
});

describe('conversation background persistence', () => {
	it('clears automatic title state on a manual rename and guards the later generated update', async () => {
		await renameOwnedConversation(owned.userId, owned.id, 'Manual title');
		const manual = query(mocks.set.mock.calls[0][0].context);
		expect(manual.sql).toContain("- 'automaticTitlePending'");
		await updateAutomaticTitle(owned.userId, owned.id, 'Study cells');
		const guard = query(mocks.where.mock.calls.at(-1)![0]);
		expect(guard.sql).toContain("->> 'automaticTitlePending' = 'true'");
		expect(guard.params).toContain(owned.userId);
		expect(guard.params).toContain(owned.id);
		expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({ timeout: 8000 }));
	});

	it('leaves the pending title untouched when generation fails so a later turn can retry', async () => {
		mocks.generateText.mockRejectedValueOnce(new Error('provider unavailable'));
		await expect(updateAutomaticTitle(owned.userId, owned.id, 'Study cells')).rejects.toThrow(
			'provider unavailable'
		);
		expect(mocks.update).not.toHaveBeenCalled();
		await updateAutomaticTitle(owned.userId, owned.id, 'Study cells');
		expect(mocks.update).toHaveBeenCalledOnce();
	});

	it('retrieves bounded eligible history in chronological order', async () => {
		mocks.limit.mockResolvedValueOnce([row(12), row(11)]);
		const rows = await getAgentHistory(owned);
		expect(rows.map((item) => item.position)).toEqual([11, 12]);
		expect(mocks.limit).toHaveBeenCalledWith(96);
		const selection = query(mocks.where.mock.calls[0][0]);
		expect(selection.params).toContain(owned.id);
		expect(selection.params).toContain('error');
		expect(selection.sql).toContain('jsonb_array_length');
	});

	it('summarizes only excluded completed rows and atomically merges its watermark', async () => {
		await summarizeConversation(owned.userId, owned.id, 20);
		expect(mocks.limit).toHaveBeenCalledWith(64);
		const selection = query(mocks.where.mock.calls[0][0]);
		expect(selection.params).toContain(20);
		expect(selection.params).toContain('streaming');
		expect(selection.params).toContain('error');
		const guard = query(mocks.where.mock.calls[1][0]);
		expect(guard.sql).toContain("->> 'summarizedThroughPosition'");
		expect(guard.params).toContain(-1);
		const update = query(mocks.set.mock.calls[0][0].context);
		expect(update.sql).toContain('|| jsonb_build_object');
		expect(update.params).toContain(10);
	});

	it('stops if another summary has already advanced the watermark', async () => {
		mocks.limit.mockResolvedValueOnce(Array.from({ length: 64 }, (_, index) => row(index)));
		mocks.returning.mockResolvedValueOnce([]);
		await summarizeConversation(owned.userId, owned.id, 100);
		expect(mocks.owned).toHaveBeenCalledOnce();
		expect(mocks.generateText).toHaveBeenCalledOnce();
	});

	it('does not advance the watermark on failure and retries the same batch later', async () => {
		mocks.generateText.mockRejectedValueOnce(new Error('summary unavailable'));
		await expect(summarizeConversation(owned.userId, owned.id, 20)).rejects.toThrow(
			'summary unavailable'
		);
		expect(mocks.update).not.toHaveBeenCalled();
		await summarizeConversation(owned.userId, owned.id, 20);
		expect(mocks.update).toHaveBeenCalledOnce();
	});

	it('does no background work after its budget expires', async () => {
		await summarizeConversation(owned.userId, owned.id, 20, 0);
		expect(mocks.owned).not.toHaveBeenCalled();
		expect(mocks.generateText).not.toHaveBeenCalled();
	});
});
