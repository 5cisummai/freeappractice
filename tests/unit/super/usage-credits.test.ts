import { describe, expect, it } from 'vitest';
import type { LanguageModelUsage } from 'ai';
import {
	millicreditsFromLanguageModelUsage,
	usdFromLanguageModelUsage,
	WEB_SEARCH_SURCHARGE_MILLI
} from '$lib/super/usage-credits';

function usage(partial: {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	noCacheTokens: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
}): LanguageModelUsage {
	return {
		inputTokens: partial.inputTokens,
		outputTokens: partial.outputTokens,
		totalTokens: partial.totalTokens,
		inputTokenDetails: {
			noCacheTokens: partial.noCacheTokens,
			cacheReadTokens: partial.cacheReadTokens ?? 0,
			cacheWriteTokens: partial.cacheWriteTokens ?? 0
		},
		outputTokenDetails: {
			textTokens: partial.outputTokens,
			reasoningTokens: 0
		}
	};
}

describe('usage credits', () => {
	it('prices uncached input and output tokens for gpt-6-luna', () => {
		const sample = usage({
			inputTokens: 1_000_000,
			outputTokens: 1_000_000,
			totalTokens: 2_000_000,
			noCacheTokens: 1_000_000
		});
		const usd = usdFromLanguageModelUsage(sample);
		expect(usd).toBeCloseTo(0.1 + 0.5, 6);
		expect(millicreditsFromLanguageModelUsage(sample)).toBe(15_000);
	});

	it('uses cache read pricing when provided', () => {
		const usd = usdFromLanguageModelUsage(
			usage({
				inputTokens: 1_000_000,
				outputTokens: 0,
				totalTokens: 1_000_000,
				noCacheTokens: 0,
				cacheReadTokens: 1_000_000
			})
		);
		expect(usd).toBeCloseTo(0.01, 6);
	});

	it('defines the web-search surcharge in millicredits', () => {
		expect(WEB_SEARCH_SURCHARGE_MILLI).toBe(250);
	});
});
