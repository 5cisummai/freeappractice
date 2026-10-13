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
	chargeUsage: (usage: LanguageModelUsage, additionalUsd?: number) => Promise<void>;
	/** Returns whether another web search is affordable; does not charge until `recordWebSearch`. */
	canAffordWebSearch: () => Promise<boolean>;
	/** Record a successful web search so its surcharge is included in `chargeUsage`. */
	recordWebSearch: () => void;
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

	let webSearchCount = 0;
	let chargePromise: Promise<void> | null = null;
	let chargedUsage: number | undefined;

	return {
		kind: 'available',
		usage,
		usageWarning: getPersonalizedUsageWarning(usage),
		chargeUsage: async (turnUsage, additionalUsd = 0) => {
			if (chargePromise) return chargePromise;
			chargePromise = (async () => {
				let millicredits = millicreditsFromLanguageModelUsage(turnUsage, additionalUsd);
				if (webSearchCount > 0) millicredits += webSearchCount * WEB_SEARCH_SURCHARGE_MILLI;
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
		},
		canAffordWebSearch: async () => {
			const current = await getPersonalizedUsage(userId, accessReason, turnStartedAt);
			return current.remaining >= (webSearchCount + 1) * WEB_SEARCH_SURCHARGE_MILLI;
		},
		recordWebSearch: () => {
			webSearchCount += 1;
		}
	};
}
