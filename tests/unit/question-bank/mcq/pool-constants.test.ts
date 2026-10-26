import { describe, expect, it } from 'vitest';
import {
	QUESTION_POOL_CONFIG,
	isBelowLowWater,
	poolRetireQuantityForBucket,
	poolTargetForBucket,
	resolveMcqTarget,
	type QuestionPoolConfig
} from '#lib/question-bank/pool-constants.js';

describe('question pool constants', () => {
	it('maps FRQ targets by type', () => {
		const config: QuestionPoolConfig = {
			...QUESTION_POOL_CONFIG,
			frqTarget: 4
		};
		expect(poolTargetForBucket({ questionType: 'frq', course: 'AP Biology', config })).toBe(4);
	});

	it('scales MCQ targets from generation-stats demand and empty/NaN fallbacks', () => {
		const counts = { 'AP Biology': 100, 'AP Chemistry': 50 };
		expect(resolveMcqTarget('AP Biology', counts)).toBe(41);
		expect(resolveMcqTarget('AP Chemistry', counts)).toBe(18);
		expect(
			poolTargetForBucket({
				questionType: 'mcq',
				course: 'AP Chemistry',
				generationCountsByCourse: counts
			})
		).toBe(18);
		expect(resolveMcqTarget('AP Biology', {})).toBe(41);
		expect(resolveMcqTarget('AP Chemistry', {})).toBe(23);
		expect(
			resolveMcqTarget('AP Chemistry', {
				'AP Biology': Number.NaN,
				'AP Chemistry': 50
			})
		).toBe(23);
	});

	it('detects low-water deficits and bulk retire quantities', () => {
		expect(isBelowLowWater(89, 100, 0.9)).toBe(true);
		expect(isBelowLowWater(90, 100, 0.9)).toBe(false);
		expect(isBelowLowWater(44, 50, 0.9)).toBe(true);
		expect(isBelowLowWater(45, 50, 0.9)).toBe(false);
		expect(poolRetireQuantityForBucket(0)).toBe(0);
		expect(poolRetireQuantityForBucket(3)).toBe(0);
		expect(poolRetireQuantityForBucket(10)).toBe(3);
		expect(poolRetireQuantityForBucket(100)).toBe(30);
	});
});
