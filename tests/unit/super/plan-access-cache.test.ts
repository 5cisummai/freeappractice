import { describe, expect, it, vi } from 'vitest';

const getPlanAccess = vi.hoisted(() => vi.fn());
vi.mock('$lib/super/billing.server', () => ({ getPlanAccess }));

import { getPlanAccessForRequest } from '$lib/super/feature-access.server';

describe('request-local plan access cache', () => {
	it('resolves billing once for a request locals object', async () => {
		const locals = {};
		getPlanAccess.mockResolvedValue({ plan: 'super', accessReason: 'subscription' });

		const first = getPlanAccessForRequest(locals, 'user-1');
		const second = getPlanAccessForRequest(locals, 'user-1');

		expect(first).toBe(second);
		expect(await second).toEqual({ plan: 'super', accessReason: 'subscription' });
		expect(getPlanAccess).toHaveBeenCalledTimes(1);
		expect(getPlanAccess).toHaveBeenCalledWith('user-1');
	});
});
