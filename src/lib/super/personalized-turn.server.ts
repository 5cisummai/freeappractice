import type { LanguageModelUsage } from 'ai';
import {
	chargePersonalizedCredits,
	getPersonalizedUsage,
	getPersonalizedUsageWarning,
	limitSuperAi,
	rollupPersonalizedUsage,
	type PersonalizedUsageWarning,
	type UsageReservation
} from '$lib/super/ai-controls.server';
import {
	millicreditsFromLanguageModelUsage,
	WEB_SEARCH_SURCHARGE_MILLI
} from '$lib/super/usage-credits';
import type { SuperAccessReason } from '$lib/super/types';

export type ReservedPersonalizedTurn = {
	kind: 'reserved';
	reservation: UsageReservation;
	usageWarning: PersonalizedUsageWarning;
	markOutput: (usage: LanguageModelUsage, additionalUsd?: number) => Promise<void>;
	/** Returns whether another web search is affordable; does not charge until `recordWebSearch`. */
	chargeWebSearch: () => Promise<boolean>;
	/** Record a successful web search so its surcharge is included in `markOutput`. */
	recordWebSearch: () => void;
	releaseIfUnused: () => Promise<void>;
};

export type PersonalizedTurnStart =
	| { kind: 'rate-limited'; retryAt: number | null }
	| { kind: 'exhausted' }
	| ReservedPersonalizedTurn;

/**
 * Shared personalized-turn ordering. Feature routes own entitlement, age, prompts,
 * locks, memory, streaming, and fallback decisions around this small lifecycle.
 */
export async function startPersonalizedTurn(
	userId: string,
	accessReason: SuperAccessReason
): Promise<PersonalizedTurnStart> {
	const rate = await limitSuperAi(userId);
	if (!rate.allowed) return { kind: 'rate-limited', retryAt: rate.retryAt };

	const turnStartedAt = new Date();
	const reservation = await getPersonalizedUsage(userId, accessReason, turnStartedAt);
	if (reservation.used >= reservation.limit) return { kind: 'exhausted' };

	let webSearchCount = 0;
	let chargePromise: Promise<void> | null = null;

	return {
		kind: 'reserved',
		reservation,
		usageWarning: getPersonalizedUsageWarning(reservation),
		markOutput: async (turnUsage, additionalUsd = 0) => {
			if (chargePromise) return chargePromise;
			chargePromise = (async () => {
				let millicredits = millicreditsFromLanguageModelUsage(turnUsage, additionalUsd);
				if (webSearchCount > 0) millicredits += webSearchCount * WEB_SEARCH_SURCHARGE_MILLI;
				const used = await chargePersonalizedCredits(
					userId,
					reservation.month,
					millicredits,
					turnStartedAt
				);
				await rollupPersonalizedUsage(userId, {
					month: reservation.month,
					used,
					limit: reservation.limit,
					remaining: Math.max(0, reservation.limit - used)
				});
			})();
			try {
				await chargePromise;
			} catch (error) {
				chargePromise = null;
				throw error;
			}
		},
		chargeWebSearch: async () => {
			const current = await getPersonalizedUsage(userId, accessReason, turnStartedAt);
			return current.remaining >= (webSearchCount + 1) * WEB_SEARCH_SURCHARGE_MILLI;
		},
		recordWebSearch: () => {
			webSearchCount += 1;
		},
		releaseIfUnused: async () => {
			// Token billing charges only after billable output; nothing to release.
		}
	};
}
