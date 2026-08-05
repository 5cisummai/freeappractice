import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isAdminUser: vi.fn(),
	retrySuperCleanupJob: vi.fn(),
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => Promise<Response>) => async (event: unknown) =>
			handler(event, (event as { locals: { user?: { id: string } } }).locals.user?.id ?? 'user-1')
}));

vi.mock('$lib/auth/admin.server', () => ({ isAdminUser: mocks.isAdminUser }));
vi.mock('$lib/super/admin.server', () => ({
	retrySuperCleanupJob: mocks.retrySuperCleanupJob
}));
vi.mock('$lib/auth/route-helpers.server', () => ({
	withAuthedHandler: mocks.withAuthedHandler
}));

import { POST } from '../../../src/routes/api/admin/super/cleanup/+server';

function event(body: unknown, userId = 'admin-1') {
	return {
		locals: { user: { id: userId } },
		request: new Request('http://localhost/api/admin/super/cleanup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<typeof POST>[0];
}

describe('Super admin cleanup route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isAdminUser.mockReturnValue(true);
		mocks.retrySuperCleanupJob.mockResolvedValue(true);
	});

	it('requires admin authorization', async () => {
		mocks.isAdminUser.mockReturnValue(false);
		const response = await POST(event({ jobId: '507f1f77bcf86cd799439011' }));

		expect(response.status).toBe(403);
		expect(mocks.retrySuperCleanupJob).not.toHaveBeenCalled();
	});

	it('validates and retries a selected failed job', async () => {
		const response = await POST(event({ jobId: '507f1f77bcf86cd799439011' }));

		expect(response.status).toBe(200);
		expect(mocks.retrySuperCleanupJob).toHaveBeenCalledWith('507f1f77bcf86cd799439011');

		const invalid = await POST(event({ jobId: '' }));
		expect(invalid.status).toBe(400);
	});
});
