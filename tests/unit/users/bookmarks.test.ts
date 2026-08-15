import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	execute: vi.fn(),
	getQuestionsByIds: vi.fn(),
	capturePostHogServerEvent: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		execute: mocks.execute
	})
}));

vi.mock('$lib/question-bank/mcq/repository.server', () => ({
	getQuestionsByIds: mocks.getQuestionsByIds
}));

vi.mock('$lib/auth/route-helpers.server', () => ({
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => Promise<Response>) =>
		(event: { locals?: { userId?: string } }) =>
			handler(event, event.locals?.userId ?? 'user-1')
}));

vi.mock('$lib/server/posthog', () => ({
	capturePostHogServerEvent: mocks.capturePostHogServerEvent
}));

import { GET, POST } from '../../../src/routes/api/me/bookmarks/+server';
import { getBookmarkedQuestions, toggleBookmark } from '$lib/users/bookmarks.server';

describe('bookmark persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
	});

	it('reads bookmark IDs directly and preserves saved order for question hydration', async () => {
		mocks.orderBy.mockResolvedValue([{ questionId: 'question-2' }, { questionId: 'question-1' }]);
		const questions = [{ id: 'question-2' }, { id: 'question-1' }];
		mocks.getQuestionsByIds.mockResolvedValue(questions);

		await expect(getBookmarkedQuestions('user-1')).resolves.toEqual(questions);
		expect(mocks.getQuestionsByIds).toHaveBeenCalledWith(['question-2', 'question-1']);
		expect(mocks.execute).not.toHaveBeenCalled();
	});

	it('toggles through one direct SQL execution and returns the database state', async () => {
		mocks.execute.mockResolvedValue({ rows: [{ bookmarked: false }] });

		await expect(toggleBookmark('user-1', 'question-1')).resolves.toBe(false);
		expect(mocks.execute).toHaveBeenCalledOnce();
		expect(mocks.select).not.toHaveBeenCalled();
	});
});

describe('bookmarks API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
	});

	it('returns hydrated bookmarks from GET', async () => {
		const bookmarks = [{ id: 'question-1' }];
		mocks.getQuestionsByIds.mockResolvedValue(bookmarks);
		const response = await GET({ locals: { userId: 'user-1' } } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ bookmarks });
	});

	it('rejects a missing question ID without changing persistence or analytics', async () => {
		const response = await POST({
			locals: { userId: 'user-1' },
			request: new Request('http://localhost/api/me/bookmarks', {
				method: 'POST',
				body: JSON.stringify({})
			})
		} as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'questionId is required' });
		expect(mocks.execute).not.toHaveBeenCalled();
		expect(mocks.capturePostHogServerEvent).not.toHaveBeenCalled();
	});

	it('preserves toggle response and PostHog event when adding a bookmark', async () => {
		mocks.execute.mockResolvedValue({ rows: [{ bookmarked: true }] });
		const request = new Request('http://localhost/api/me/bookmarks', {
			method: 'POST',
			body: JSON.stringify({ questionId: 'question-1' })
		});

		const response = await POST({ locals: { userId: 'user-1' }, request } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: 'Bookmark added', bookmarked: true });
		expect(mocks.execute).toHaveBeenCalledOnce();
		expect(mocks.capturePostHogServerEvent).toHaveBeenCalledWith(request, {
			distinctId: 'user-1',
			event: 'question_bookmark_toggled',
			properties: {
				question_id: 'question-1',
				bookmarked: true
			}
		});
	});
});
