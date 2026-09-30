import type { LanguageModelUsage } from 'ai';
import type { SuperAccessReason } from '$lib/super/types';

/** Display/API: 25 credits per USD. */
export const CREDITS_PER_USD = 25;

export const SUPER_FREE_BETA_MONTHLY_USD = 2;
export const SUPER_MONTHLY_USD = 8;

export const SUPER_FREE_BETA_MONTHLY_CREDITS = SUPER_FREE_BETA_MONTHLY_USD * CREDITS_PER_USD;
export const SUPER_MONTHLY_CREDITS = SUPER_MONTHLY_USD * CREDITS_PER_USD;

/** One credit = 1000 millicredits (supports 0.25 credit surcharges). */
export const MILLICREDITS_PER_CREDIT = 1000;

export const SUPER_FREE_BETA_MONTHLY_CREDITS_MILLI =
	SUPER_FREE_BETA_MONTHLY_CREDITS * MILLICREDITS_PER_CREDIT;
export const SUPER_MONTHLY_CREDITS_MILLI = SUPER_MONTHLY_CREDITS * MILLICREDITS_PER_CREDIT;

export const WEB_SEARCH_SURCHARGE_MILLI = 250;

/** Standard per-token rates from AI Gateway's model catalog. */
const MODEL_PRICING = {
	'gpt-6-luna': {
		input: 0.000_000_1,
		cacheRead: 0.000_000_01,
		cacheWrite: 0.000_000_125,
		output: 0.000_000_5
	},
	'gpt-6.1-sol': {
		input: 0.000_002,
		cacheRead: 0.000_000_1,
		cacheWrite: 0.000_002_5,
		output: 0.000_01
	}
} as const;
type PricedModel = keyof typeof MODEL_PRICING;

export function monthlyCreditLimitMilli(accessReason: SuperAccessReason): number {
	return accessReason === 'free_beta'
		? SUPER_FREE_BETA_MONTHLY_CREDITS_MILLI
		: SUPER_MONTHLY_CREDITS_MILLI;
}

export function formatCreditsFromMilli(millicredits: number): string {
	const credits = millicredits / MILLICREDITS_PER_CREDIT;
	if (Math.abs(credits - Math.round(credits)) < 0.001) return String(Math.round(credits));
	return credits.toFixed(2).replace(/\.?0+$/, '');
}

export function usdFromLanguageModelUsage(
	usage: LanguageModelUsage,
	model: PricedModel = 'gpt-6-luna'
): number {
	const inputTokens = usage.inputTokens ?? 0;
	const outputTokens = usage.outputTokens ?? 0;
	const details = usage.inputTokenDetails;
	const cacheRead = details?.cacheReadTokens ?? usage.cachedInputTokens ?? 0;
	const cacheWrite = details?.cacheWriteTokens ?? 0;
	const noCache = details?.noCacheTokens ?? Math.max(0, inputTokens - cacheRead - cacheWrite);

	const base = MODEL_PRICING[model];
	const longContext = model === 'gpt-6.1-sol' && inputTokens >= 272_001;
	const inputMultiplier = longContext ? 2 : 1;
	const outputMultiplier = longContext ? 1.5 : 1;

	return (
		noCache * base.input * inputMultiplier +
		cacheRead * base.cacheRead * inputMultiplier +
		cacheWrite * base.cacheWrite * inputMultiplier +
		outputTokens * base.output * outputMultiplier
	);
}

export function millicreditsFromLanguageModelUsage(
	usage: LanguageModelUsage,
	additionalUsd = 0
): number {
	const usd = usdFromLanguageModelUsage(usage) + additionalUsd;
	return Math.max(0, Math.round(usd * CREDITS_PER_USD * MILLICREDITS_PER_CREDIT));
}

export function createEmptyLanguageModelUsage(): LanguageModelUsage {
	return {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		inputTokenDetails: {
			noCacheTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0
		},
		outputTokenDetails: {
			textTokens: 0,
			reasoningTokens: 0
		}
	};
}

function noCacheTokensFromUsage(usage: LanguageModelUsage): number {
	const details = usage.inputTokenDetails;
	if (details?.noCacheTokens != null) return details.noCacheTokens;
	const inputTokens = usage.inputTokens ?? 0;
	const cacheRead = details?.cacheReadTokens ?? usage.cachedInputTokens ?? 0;
	const cacheWrite = details?.cacheWriteTokens ?? 0;
	return Math.max(0, inputTokens - cacheRead - cacheWrite);
}

export function addLanguageModelUsage(
	target: LanguageModelUsage,
	step: LanguageModelUsage
): LanguageModelUsage {
	const inputTokens = (target.inputTokens ?? 0) + (step.inputTokens ?? 0);
	const outputTokens = (target.outputTokens ?? 0) + (step.outputTokens ?? 0);
	const totalTokens = (target.totalTokens ?? 0) + (step.totalTokens ?? 0);

	return {
		inputTokens,
		outputTokens,
		totalTokens,
		inputTokenDetails: {
			noCacheTokens: noCacheTokensFromUsage(target) + noCacheTokensFromUsage(step),
			cacheReadTokens:
				(target.inputTokenDetails?.cacheReadTokens ?? 0) +
				(step.inputTokenDetails?.cacheReadTokens ?? 0),
			cacheWriteTokens:
				(target.inputTokenDetails?.cacheWriteTokens ?? 0) +
				(step.inputTokenDetails?.cacheWriteTokens ?? 0)
		},
		outputTokenDetails: {
			textTokens:
				(target.outputTokenDetails?.textTokens ?? 0) + (step.outputTokenDetails?.textTokens ?? 0),
			reasoningTokens:
				(target.outputTokenDetails?.reasoningTokens ?? 0) +
				(step.outputTokenDetails?.reasoningTokens ?? 0)
		}
	};
}
