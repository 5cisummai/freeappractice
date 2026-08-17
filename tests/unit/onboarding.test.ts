import { describe, expect, it } from 'vitest';
import { readOnboardingState, serializeCompletedOnboarding } from '$lib/onboarding';

describe('onboarding state', () => {
	it('round-trips completed subjects and goals', () => {
		const value = serializeCompletedOnboarding(['AP Biology'], ['exam_prep']);

		expect(readOnboardingState(value)).toEqual({
			status: 'complete',
			subjects: ['AP Biology'],
			goals: ['exam_prep']
		});
	});

	it('ignores invalid persisted goals', () => {
		expect(
			readOnboardingState(
				JSON.stringify({ status: 'complete', subjects: ['AP Biology'], goals: ['invalid'] })
			)
		).toEqual({ status: 'complete', subjects: ['AP Biology'], goals: [] });
	});
});
