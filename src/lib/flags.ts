import { flag } from 'flags/sveltekit';
import type { Adapter } from 'flags';
import { vercelAdapter } from '@flags-sdk/vercel';
import { getRedisClient, redisNamespace, withRedisTimeout } from '$lib/redis/server';

const FLAGS_CACHE_TTL_SECONDS = 60 * 60;

type BooleanVercelAdapter = Adapter<boolean, Record<string, unknown>>;

function flagsCacheKey(key: string): string {
	return `${redisNamespace()}:flags:${key}`;
}

async function readCachedFlag(
	redis: NonNullable<ReturnType<typeof getRedisClient>>,
	key: string
): Promise<boolean | undefined> {
	try {
		const value = await withRedisTimeout(redis.get<boolean>(flagsCacheKey(key)));
		return typeof value === 'boolean' ? value : undefined;
	} catch {
		return undefined;
	}
}

async function writeCachedFlag(
	redis: NonNullable<ReturnType<typeof getRedisClient>>,
	key: string,
	value: boolean
): Promise<void> {
	try {
		await withRedisTimeout(redis.set(flagsCacheKey(key), value, { ex: FLAGS_CACHE_TTL_SECONDS }));
	} catch {
		// Flag evaluation remains available if Redis is unavailable.
	}
}

function cachedVercelAdapter(): BooleanVercelAdapter {
	const adapter = vercelAdapter<boolean, Record<string, unknown>>();
	const decide = adapter.decide;
	const bulkDecide = adapter.bulkDecide;

	return {
		...adapter,
		async decide(params) {
			// Entity-targeted flags must never share a global cache entry.
			if (params.entities !== undefined) return decide(params);

			const redis = getRedisClient();
			if (!redis) return decide(params);

			const cached = await readCachedFlag(redis, params.key);
			if (cached !== undefined) return cached;

			const value = await decide(params);
			await writeCachedFlag(redis, params.key, value);
			return value;
		},
		...(bulkDecide
			? {
					async bulkDecide(params: Parameters<NonNullable<typeof bulkDecide>>[0]) {
						if (params.entities !== undefined) return bulkDecide(params);

						const redis = getRedisClient();
						if (!redis) return bulkDecide(params);

						const cachedEntries = await Promise.all(
							params.flags.map(
								async (flag) => [flag.key, await readCachedFlag(redis, flag.key)] as const
							)
						);
						const values: Record<string, boolean> = Object.fromEntries(
							cachedEntries.filter((entry): entry is [string, boolean] => entry[1] !== undefined)
						);
						const missingFlags = params.flags.filter(({ key }) => !Object.hasOwn(values, key));

						if (missingFlags.length === 0) return values;

						const freshValues = await bulkDecide({ ...params, flags: missingFlags });
						await Promise.all(
							Object.entries(freshValues).map(([key, value]) => writeCachedFlag(redis, key, value))
						);
						return { ...values, ...freshValues };
					}
				}
			: {})
	};
}

/**
 * Sticky multi-attempt-with-hints practice experiment.
 * Managed in the Vercel Flags dashboard (`multi-attempt-experiment`).
 * Default off in all environments until you flip it there — no env var.
 */
function vercelFlag(key: string, description: string, defaultValue: boolean) {
	return flag<boolean>({
		key,
		description,
		adapter: cachedVercelAdapter(),
		defaultValue,
		options: [
			{ value: true, label: 'On' },
			{ value: false, label: 'Off' }
		]
	});
}

export const multiAttemptExperimentEnabled = vercelFlag(
	'multi-attempt-experiment',
	'Enable sticky multi-attempt-with-hints practice experiment',
	false
);

export async function isMultiAttemptExperimentEnabled(): Promise<boolean> {
	try {
		return Boolean(await multiAttemptExperimentEnabled());
	} catch {
		return false;
	}
}

/**
 * Authenticated FRQ practice pilot.
 * Managed in the Vercel Flags dashboard (`frq-practice`).
 * Default off until you flip it there — no env var.
 */
export const frqPracticeEnabled = vercelFlag(
	'frq-practice',
	'Enable authenticated written-response practice for pilot courses',
	false
);

export async function isFrqPracticeEnabled(): Promise<boolean> {
	try {
		return Boolean(await frqPracticeEnabled());
	} catch {
		return false;
	}
}

/**
 * Educational examfig diagrams.
 * Managed in the Vercel Flags dashboard (`examfig-diagrams`).
 * Controls diagram generation; cached diagram data is served as stored.
 */
export const examfigDiagramsEnabled = vercelFlag(
	'examfig-diagrams',
	'Enable examfig diagrams during MCQ generation',
	false
);

export async function isExamfigDiagramsEnabled(): Promise<boolean> {
	try {
		return Boolean(await examfigDiagramsEnabled());
	} catch {
		return false;
	}
}

/**
 * Free Super beta offer for authenticated users (claim required).
 * Managed in the Vercel Flags dashboard (`super-free-beta`).
 * Default off until you flip it there — no env var.
 */
export const superFreeBetaEnabled = vercelFlag(
	'super-free-beta',
	'Offer authenticated users a claimable free Super beta',
	false
);

export async function isSuperFreeBetaEnabled(request?: Request): Promise<boolean> {
	try {
		return Boolean(await superFreeBetaEnabled(request));
	} catch {
		return false;
	}
}

function superKillSwitch(key: string, description: string) {
	return vercelFlag(key, description, true);
}

/** Kill switches only. Entitlements always come from durable billing/grant records. */
export const superCheckoutEnabled = superKillSwitch('super-checkout', 'Allow new Super checkouts');
export const superCoachEnabled = superKillSwitch('super-coach', 'Allow the Super AI Coach');
export const superMemoryEnabled = superKillSwitch(
	'super-memory',
	'Allow Mem0-backed Super tutor memory'
);
export const superInsightsEnabled = superKillSwitch(
	'super-insights',
	'Allow Super insights and study plans'
);

async function readSuperKillSwitch(feature: ReturnType<typeof superKillSwitch>): Promise<boolean> {
	try {
		return Boolean(await feature());
	} catch {
		return true;
	}
}

export const isSuperCheckoutEnabled = () => readSuperKillSwitch(superCheckoutEnabled);
export const isSuperCoachEnabled = () => readSuperKillSwitch(superCoachEnabled);
export const isSuperMemoryEnabled = () => readSuperKillSwitch(superMemoryEnabled);
export const isSuperInsightsEnabled = () => readSuperKillSwitch(superInsightsEnabled);
