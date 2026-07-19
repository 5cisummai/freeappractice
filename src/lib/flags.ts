import { flag } from 'flags/sveltekit';
import { vercelAdapter } from '@flags-sdk/vercel';

/**
 * Kill-switch / rollout gate for the multi-attempt experiment.
 * Sticky cohort assignment still lives on the user profile (Linear DEV-61).
 * Managed in the Vercel Flags dashboard after the draft is promoted.
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

/** Authenticated FRQ practice pilot gate — controlled via Vercel Flags. */
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
