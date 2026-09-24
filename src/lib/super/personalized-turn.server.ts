import {
	getPersonalizedUsageWarning,
	limitSuperAi,
	releasePersonalizedTurn,
	reservePersonalizedTurn,
	rollupPersonalizedUsage,
	type PersonalizedUsageWarning,
	type UsageReservation
} from '$lib/super/ai-controls.server';

export type ReservedPersonalizedTurn = {
	kind: 'reserved';
	reservation: UsageReservation;
	usageWarning: PersonalizedUsageWarning;
	markOutput: () => Promise<void>;
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
export async function startPersonalizedTurn(userId: string): Promise<PersonalizedTurnStart> {
	const rate = await limitSuperAi(userId);
	if (!rate.allowed) return { kind: 'rate-limited', retryAt: rate.retryAt };

	const turnStartedAt = new Date();
	const reservation = await reservePersonalizedTurn(userId, turnStartedAt);
	if (!reservation) return { kind: 'exhausted' };

	let outputStarted = false;
	let released = false;
	let searchCharge: Promise<boolean> | undefined;
	return {
		kind: 'reserved',
		reservation,
		usageWarning: getPersonalizedUsageWarning(reservation),
		markOutput: async () => {
			if (outputStarted || released) return;
			outputStarted = true;
			await rollupPersonalizedUsage(userId, reservation);
		},
		chargeWebSearch: () => {
			searchCharge ??= (async () => {
				const extra = await reservePersonalizedTurn(userId, turnStartedAt, 2);
				if (!extra) return false;
				reservation.used = extra.used;
				reservation.remaining = extra.remaining;
				return true;
			})();
			return searchCharge;
		},
		releaseIfUnused: async () => {
			if (outputStarted || released) return;
			released = true;
			const searchCharged = await searchCharge?.catch(() => false);
			await releasePersonalizedTurn(userId, reservation.month, searchCharged ? 3 : 1);
		}
	};
}
