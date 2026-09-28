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
	markOutput: (usage: LanguageModelUsage) => Promise<void>;
	chargeWebSearch: () => Promise<boolean>;
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

	let outputStarted = false;
	let webSearchCharged = false;
	let searchCheck: Promise<boolean> | undefined;

	return {
		kind: 'reserved',
		reservation,
		usageWarning: getPersonalizedUsageWarning(reservation),
		markOutput: async (turnUsage) => {
			if (outputStarted) return;
			outputStarted = true;
			let millicredits = millicreditsFromLanguageModelUsage(turnUsage);
			if (webSearchCharged) millicredits += WEB_SEARCH_SURCHARGE_MILLI;
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
		},
		chargeWebSearch: () => {
			searchCheck ??= (async () => {
				const current = await getPersonalizedUsage(userId, accessReason, turnStartedAt);
				if (current.remaining < WEB_SEARCH_SURCHARGE_MILLI) return false;
				webSearchCharged = true;
				return true;
			})();
			return searchCheck;
		},
		releaseIfUnused: async () => {
			// Token billing charges only after billable output; nothing to release.
		}
	};
}
