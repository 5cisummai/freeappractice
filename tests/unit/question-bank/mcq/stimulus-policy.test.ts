import { describe, expect, it } from 'vitest';
import {
	getStimulusPolicy,
	getSupportedStimulusCourseNames,
	isStimulusPolicyEnabledForUnit
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
			expect(policy).not.toHaveProperty('enabled');
			expect(policy.enabledUnits).toHaveLength(3);
			expect(policy.profiles.length).toBeGreaterThan(0);
			expect(policy.profiles[0]!.minChildren).toBeGreaterThan(1);
		}
	});

	it('fails closed for courses outside the pilot', () => {
		expect(getStimulusPolicy('AP Calculus AB')).toMatchObject({
			quizTargetQuestionPercent: 0,
			setsEnabled: false,
			profiles: []
		});
		expect(getStimulusPolicy('constructor')).toMatchObject({
			quizTargetQuestionPercent: 0,
			setsEnabled: false,
			profiles: []
		});
	});

	it('supports explicit unit exclusions with precedence over an allowlist', () => {
		const policy = {
			...getStimulusPolicy('AP Biology'),
			enabledUnits: ['Unit 1: Chemistry of Life', 'Unit 2: Cells'],
			excludedUnits: ['Unit 2: Cells']
		};

		expect(isStimulusPolicyEnabledForUnit(policy, 'Unit 1: Chemistry of Life')).toBe(true);
		expect(isStimulusPolicyEnabledForUnit(policy, 'Unit 2: Cells')).toBe(false);
		expect(isStimulusPolicyEnabledForUnit(policy, 'Unit 3: Cellular Energetics')).toBe(false);
	});
});
