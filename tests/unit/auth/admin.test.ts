import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	BETTER_AUTH_ADMIN_USER_IDS: '' as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

import { getAdminUserIds, isAdminUser } from '$lib/auth/admin.server';

describe('admin helpers', () => {
	beforeEach(() => {
		privateEnv.BETTER_AUTH_ADMIN_USER_IDS = '';
	});

	it('parses comma-separated admin ids', () => {
		privateEnv.BETTER_AUTH_ADMIN_USER_IDS = ' admin1 ,admin2, ,admin3 ';
		expect(getAdminUserIds()).toEqual(['admin1', 'admin2', 'admin3']);
	});

	it('returns an empty list when unset', () => {
		privateEnv.BETTER_AUTH_ADMIN_USER_IDS = undefined;
		expect(getAdminUserIds()).toEqual([]);
	});

	it('checks membership by user id', () => {
		privateEnv.BETTER_AUTH_ADMIN_USER_IDS = 'admin1,admin2';
		expect(isAdminUser(null)).toBe(false);
		expect(isAdminUser({ id: 'admin1' })).toBe(true);
		expect(isAdminUser({ id: 'user3' })).toBe(false);
	});
});
