import { flag } from 'flags/sveltekit';
import type { Adapter } from 'flags';
import { vercelAdapter } from '@flags-sdk/vercel';

type BooleanVercelAdapter = Adapter<boolean, Record<string, unknown>>;

/**
 * Defer `vercelAdapter()` until first evaluation so an empty `FLAGS` key
 * cannot crash module load. Definition caching is handled by flags-core.
 */
function lazyVercelAdapter(): BooleanVercelAdapter {
	let inner: BooleanVercelAdapter | undefined;
	const getInner = (): BooleanVercelAdapter => {
		inner ??= vercelAdapter<boolean, Record<string, unknown>>();
		return inner;
	};

	return {
		get adapterId() {
			return getInner().adapterId;
		},
		get origin() {
			return getInner().origin;
		},
		config: { reportValue: false },
		decide: (params) => getInner().decide(params),
		bulkDecide: (params) => {
			const bulkDecide = getInner().bulkDecide;
			if (!bulkDecide) {
				throw new Error('flags: Vercel adapter is missing bulkDecide');
			}
			return bulkDecide(params);
		}
	} as BooleanVercelAdapter;
}

function vercelFlag(key: string, description: string, defaultValue: boolean) {
	return flag<boolean>({
		key,
		description,
		adapter: lazyVercelAdapter(),
		defaultValue,
		options: [
			{ value: true, label: 'On' },
			{ value: false, label: 'Off' }
		]
	});
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
 * Unified stimulus-question pilot, including semantic Examfig diagrams.
 * Managed in the Vercel Flags dashboard (`stimulus-questions`).
 * Cached history remains readable; the flag controls generation and random serving.
 */
export const stimulusQuestionsEnabled = vercelFlag(
	'stimulus-questions',
	'Enable original MCQ stimuli and Examfig diagrams during generation and random serving',
	false
);

export async function isStimulusQuestionsEnabled(): Promise<boolean> {
	try {
		return Boolean(await stimulusQuestionsEnabled());
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

/** Kill switches only. Plan access always comes from durable billing/grant records. */
export const superCheckoutEnabled = superKillSwitch('super-checkout', 'Allow new Super checkouts');
export const superCoachEnabled = superKillSwitch('super-coach', 'Allow the Super AI Coach');
export const superMemoryEnabled = superKillSwitch(
	'super-memory',
	'Allow Mem0-backed Super tutor memory'
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
