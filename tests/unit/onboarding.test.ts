import { describe, expect, it } from 'vitest';
import { readOnboardingState, serializeCompletedOnboarding } from '$lib/onboarding';

describe('onboarding state', () => {
	it('round-trips completed goals', () => {
		const value = serializeCompletedOnboarding(['exam_prep']);

		expect(readOnboardingState(value)).toEqual({
			status: 'complete',
			goals: ['exam_prep']
		});
	});

	it('ignores invalid persisted goals', () => {
		expect(readOnboardingState(JSON.stringify({ status: 'complete', goals: ['invalid'] }))).toEqual(
			{ status: 'complete', goals: [] }
		);
	});
});
