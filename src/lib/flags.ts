import { flag } from 'flags/sveltekit';
import { vercelAdapter } from '@flags-sdk/vercel';

/**
 * Sticky multi-attempt-with-hints practice experiment.
 * Managed in the Vercel Flags dashboard (`multi-attempt-experiment`).
 * Default off in all environments until you flip it there — no env var.
 */
function vercelFlag(key: string, description: string, defaultValue: boolean) {
	return flag<boolean>({
		key,
		description,
		adapter: vercelAdapter(),
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

export async function isSuperFreeBetaEnabled(): Promise<boolean> {
	try {
		return Boolean(await superFreeBetaEnabled());
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
