import { beforeEach, describe, expect, it, vi } from 'vitest';

const isAdminUser = vi.hoisted(() => vi.fn());

vi.mock('$lib/auth/admin.server', () => ({ isAdminUser }));

import { load } from '../../../src/routes/app/admin/+layout.server';

function event(locals: Record<string, unknown>) {
	return { locals } as unknown as Parameters<typeof load>[0];
}

describe('admin layout authorization', () => {
	beforeEach(() => {
		isAdminUser.mockReset();
	});

	it('redirects unauthenticated requests to login', () => {
		expect(() => load(event({}))).toThrowError(
			expect.objectContaining({ status: 302, location: '/login' })
		);
	});

	it('rejects authenticated non-admin users', () => {
		isAdminUser.mockReturnValue(false);

		expect(() =>
			load(event({ session: { id: 'session-1' }, user: { id: 'user-1' } }))
		).toThrowError(expect.objectContaining({ status: 403 }));
	});

	it('allows authenticated admins', () => {
		isAdminUser.mockReturnValue(true);

		expect(load(event({ session: { id: 'session-1' }, user: { id: 'admin-1' } }))).toBeUndefined();
	});
});
