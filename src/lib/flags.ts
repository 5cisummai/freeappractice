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
