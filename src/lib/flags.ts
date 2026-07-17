import { flag } from 'flags/sveltekit';
import { env } from '$env/dynamic/private';

/**
 * Kill-switch / rollout gate for the multi-attempt experiment.
 * Sticky cohort assignment still lives on the user profile (Linear DEV-61).
 * Default decide() is true so the experiment runs without a Flags project;
 * override via Flags Explorer when FLAGS_SECRET + toolbar are configured.
 */
export const multiAttemptExperimentEnabled = flag<boolean>({
	key: 'multi-attempt-experiment',
	description: 'Enable sticky multi-attempt-with-hints practice experiment',
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	],
	decide() {
		return true;
	}
});

export async function isMultiAttemptExperimentEnabled(): Promise<boolean> {
	try {
		return Boolean(await multiAttemptExperimentEnabled());
	} catch {
		return true;
	}
}

export const frqPracticeEnabled = flag<boolean>({
	key: 'frq-practice',
	description: 'Enable authenticated written-response practice for pilot courses',
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	],
	decide() {
		return env.FRQ_PRACTICE_ENABLED === 'true';
	}
});

export async function isFrqPracticeEnabled(): Promise<boolean> {
	try {
		return Boolean(await frqPracticeEnabled());
	} catch {
		return env.FRQ_PRACTICE_ENABLED === 'true';
	}
}
