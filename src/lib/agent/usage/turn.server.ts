import type { LanguageModelUsage } from 'ai';
import {
	chargePersonalizedCredits,
	getPersonalizedUsage,
	getPersonalizedUsageWarning,
	limitSuperAi,
	rollupPersonalizedUsage,
	type PersonalizedUsageWarning,
	type AgentUsage
} from '#lib/agent/usage/controls.server.js';
import {
	millicreditsFromLanguageModelUsage,
	WEB_SEARCH_SURCHARGE_MILLI
} from '#lib/agent/usage/credits.js';
import type { SuperAccessReason } from '#lib/billing/types.js';

export type AvailableAgentTurn = {
	kind: 'available';
	usage: AgentUsage;
	usageWarning: PersonalizedUsageWarning;
	chargeUsage: (
		usage: LanguageModelUsage,
		additionalUsd?: number,
		successfulSearches?: number
	) => Promise<void>;
};

export type AgentTurnStart =
	{ kind: 'rate-limited'; retryAt: number | null } | { kind: 'exhausted' } | AvailableAgentTurn;

/**
 * Shared personalized-turn ordering. Feature routes own entitlement, age, prompts,
 * locks, memory, streaming, and fallback decisions around this small lifecycle.
 */
export async function startAgentTurn(
	userId: string,
	accessReason: SuperAccessReason
): Promise<AgentTurnStart> {
	const rate = await limitSuperAi(userId);
	if (!rate.allowed) return { kind: 'rate-limited', retryAt: rate.retryAt };

	const turnStartedAt = new Date();
	const usage = await getPersonalizedUsage(userId, accessReason, turnStartedAt);
	if (usage.used >= usage.limit) return { kind: 'exhausted' };

	let chargePromise: Promise<void> | null = null;
	let chargedUsage: number | undefined;

	return {
		kind: 'available',
		usage,
		usageWarning: getPersonalizedUsageWarning(usage),
		chargeUsage: async (turnUsage, additionalUsd = 0, successfulSearches = 0) => {
			if (chargePromise) return chargePromise;
			chargePromise = (async () => {
				const millicredits =
					millicreditsFromLanguageModelUsage(turnUsage, additionalUsd) +
					successfulSearches * WEB_SEARCH_SURCHARGE_MILLI;
				const used =
					chargedUsage ??
					(await chargePersonalizedCredits(userId, usage.month, millicredits, turnStartedAt));
				chargedUsage = used;
				await rollupPersonalizedUsage(userId, {
					month: usage.month,
					used,
					limit: usage.limit,
					remaining: Math.max(0, usage.limit - used)
				});
			})();
			try {
				await chargePromise;
			} catch (error) {
				chargePromise = null;
				throw error;
			}
		}
	};
}
