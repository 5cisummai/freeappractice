import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getNeonDatabase: vi.fn(),
	insert: vi.fn(),
	values: vi.fn(),
	limitBugReports: vi.fn(),
	loggerInfo: vi.fn(),
	loggerWarn: vi.fn(),
	loggerError: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({ getNeonDatabase: mocks.getNeonDatabase }));
vi.mock('$lib/server/neon/schema', () => ({ bugReports: {} }));
vi.mock('$lib/bug-report/rate-limit.server', () => ({
	limitBugReports: mocks.limitBugReports
}));
vi.mock('$lib/server/logger', () => ({
	logger: {
		info: mocks.loggerInfo,
		warn: mocks.loggerWarn,
		error: mocks.loggerError
	}
}));

import { submitBugReport } from '$lib/bug-report/server';

describe('submitBugReport', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitBugReports.mockResolvedValue({
			allowed: true,
			retryAt: null,
			degraded: false
		});
		mocks.values.mockResolvedValue(undefined);
		mocks.insert.mockReturnValue({ values: mocks.values });
		mocks.getNeonDatabase.mockReturnValue({ insert: mocks.insert });
	});

	it('stores an authenticated report in Neon without contacting GitHub', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const response = await submitBugReport(
			new Request('https://freeappractice.org/api/bug-report', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					title: 'Broken submit button',
					description: 'Clicking submit does nothing on the practice page.',
					severity: 'high',
					metadata: { questionId: 'q-1' }
				})
			}),
			'203.0.113.8',
			'user-1'
		);

		expect(response.status).toBe(201);
		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				title: 'Broken submit button',
				description: 'Clicking submit does nothing on the practice page.',
				severity: 'high',
				metadata: { questionId: 'q-1' }
			})
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
