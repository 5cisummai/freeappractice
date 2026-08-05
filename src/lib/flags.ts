import { flag } from 'flags/sveltekit';
import { vercelAdapter } from '@flags-sdk/vercel';

/**
 * Sticky multi-attempt-with-hints practice experiment.
 * Managed in the Vercel Flags dashboard (`multi-attempt-experiment`).
 * Default off in all environments until you flip it there — no env var.
 */
export const multiAttemptExperimentEnabled = flag<boolean>({
	key: 'multi-attempt-experiment',
	description: 'Enable sticky multi-attempt-with-hints practice experiment',
	adapter: vercelAdapter(),
	defaultValue: false,
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	]
});

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
export const frqPracticeEnabled = flag<boolean>({
	key: 'frq-practice',
	description: 'Enable authenticated written-response practice for pilot courses',
	adapter: vercelAdapter(),
	defaultValue: false,
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	]
});

export async function isFrqPracticeEnabled(): Promise<boolean> {
	try {
		return Boolean(await frqPracticeEnabled());
	} catch {
		return false;
	}
}

function superKillSwitch(key: string, description: string) {
	return flag<boolean>({
		key,
		description,
		adapter: vercelAdapter(),
		defaultValue: true,
		options: [
			{ value: true, label: 'On' },
			{ value: false, label: 'Off' }
		]
	});
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
