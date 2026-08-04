import { describe, expect, it } from 'vitest';
import { isPoolWarmingResponse, POOL_WARMING_CODE } from '$lib/questions/payload';

describe('POOL_WARMING payload', () => {
	it('detects typed warming responses', () => {
		expect(
			isPoolWarmingResponse({
				code: POOL_WARMING_CODE,
				error: 'warming',
				retryAfterSeconds: 15
			})
		).toBe(true);
	});

	it('rejects incomplete or unrelated payloads', () => {
		expect(isPoolWarmingResponse({ code: 'POOL_WARMING' })).toBe(false);
		expect(isPoolWarmingResponse({ error: 'nope' })).toBe(false);
		expect(isPoolWarmingResponse(null)).toBe(false);
	});
});
