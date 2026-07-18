import { flag } from 'flags/sveltekit';

/**
 * Kill-switch / rollout gate for the multi-attempt experiment.
 * Sticky cohort assignment still lives on the user profile (Linear DEV-61).
 * Temporarily disabled while the practice auth flow is stabilized.
 */
export const multiAttemptExperimentEnabled = flag<boolean>({
	key: 'multi-attempt-experiment',
	description: 'Enable sticky multi-attempt-with-hints practice experiment',
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	],
	decide() {
		return false;
	}
});

export async function isMultiAttemptExperimentEnabled(): Promise<boolean> {
	return false;
}
