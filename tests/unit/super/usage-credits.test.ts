import { describe, expect, it } from 'vitest';
import {
	millicreditsFromLanguageModelUsage,
	usdFromLanguageModelUsage,
	WEB_SEARCH_SURCHARGE_MILLI
} from '$lib/super/usage-credits';

describe('usage credits', () => {
	it('prices uncached input and output tokens for gpt-6-luna', () => {
		const usd = usdFromLanguageModelUsage({
			inputTokens: 1_000_000,
			outputTokens: 1_000_000,
			totalTokens: 2_000_000,
			inputTokenDetails: { noCacheTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 }
		});
		expect(usd).toBeCloseTo(0.1 + 0.5, 6);
		expect(millicreditsFromLanguageModelUsage({
			inputTokens: 1_000_000,
			outputTokens: 1_000_000,
			totalTokens: 2_000_000,
			inputTokenDetails: { noCacheTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 }
		})).toBe(15_000);
	});

	it('uses cache read pricing when provided', () => {
		const usd = usdFromLanguageModelUsage({
			inputTokens: 1_000_000,
			outputTokens: 0,
			totalTokens: 1_000_000,
			inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 }
		});
		expect(usd).toBeCloseTo(0.01, 6);
	});

	it('defines the web-search surcharge in millicredits', () => {
		expect(WEB_SEARCH_SURCHARGE_MILLI).toBe(250);
	});
});
