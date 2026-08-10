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

	const reservation = await reservePersonalizedTurn(userId);
	if (!reservation) return { kind: 'exhausted' };

	let outputStarted = false;
	let released = false;
	return {
		kind: 'reserved',
		reservation,
		usageWarning: getPersonalizedUsageWarning(reservation),
		markOutput: async () => {
			if (outputStarted || released) return;
			outputStarted = true;
			await rollupPersonalizedUsage(userId, reservation);
		},
		releaseIfUnused: async () => {
			if (outputStarted || released) return;
			released = true;
			await releasePersonalizedTurn(userId, reservation.month);
		}
	};
}
