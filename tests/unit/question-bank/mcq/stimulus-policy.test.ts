import { describe, expect, it } from 'vitest';
import {
	getStimulusPolicy,
	getSupportedStimulusCourseNames
} from '$lib/question-bank/mcq/stimulus-policy';

describe('stimulus pilot policy', () => {
	it('defines the five pilot courses with conservative profiles', () => {
		expect(getSupportedStimulusCourseNames()).toEqual([
			'AP Biology',
			'AP Chemistry',
			'AP Physics 1',
			'AP World History',
			'AP Human Geography'
		]);
		for (const course of getSupportedStimulusCourseNames()) {
			const policy = getStimulusPolicy(course);
			expect(policy.enabled).toBe(false);
			expect(policy.profiles.length).toBeGreaterThan(0);
			expect(policy.profiles[0]!.minChildren).toBeGreaterThan(1);
		}
	});

	it('fails closed for courses outside the pilot', () => {
		expect(getStimulusPolicy('AP Calculus AB')).toMatchObject({
			enabled: false,
			quizTargetQuestionPercent: 0,
			profiles: []
		});
	});
});
