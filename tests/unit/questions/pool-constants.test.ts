import { describe, expect, it } from 'vitest';
import {
	QUESTION_POOL_CONFIG,
	QUESTION_POOL_DEFAULT_MCQ_TARGET,
	QUESTION_POOL_FRQ_TARGET,
	QUESTION_POOL_MIN_MCQ_TARGET,
	isBelowLowWater,
	poolTargetForBucket,
	preferredMcqTarget,
	resolveMcqTarget,
	type QuestionPoolConfig
} from '$lib/questions/pool-constants';

describe('question pool constants', () => {
	it('loads JSON defaults', () => {
		expect(QUESTION_POOL_DEFAULT_MCQ_TARGET).toBe(20);
		expect(QUESTION_POOL_MIN_MCQ_TARGET).toBe(10);
		expect(QUESTION_POOL_FRQ_TARGET).toBe(8);
		expect(preferredMcqTarget('AP Biology')).toBe(35);
		expect(preferredMcqTarget('AP Chemistry')).toBe(20);
		expect(QUESTION_POOL_CONFIG.mcqTarget).toBe(20);
		expect(QUESTION_POOL_CONFIG.frqTarget).toBe(8);
	});

	it('maps FRQ targets by type', () => {
		const config: QuestionPoolConfig = {
			...QUESTION_POOL_CONFIG,
			frqTarget: 4
		};
		expect(poolTargetForBucket({ questionType: 'frq', apClass: 'AP Biology', config })).toBe(4);
	});

	it('scales MCQ targets from generation-stats demand', () => {
		const counts = {
			'AP Biology': 100,
			'AP Chemistry': 50,
			'AP Lunch😂': 0
		};
		expect(resolveMcqTarget('AP Biology', counts)).toBe(35);
		expect(resolveMcqTarget('AP Chemistry', counts)).toBe(15);
		expect(resolveMcqTarget('AP Lunch😂', counts)).toBe(10);
		expect(
			poolTargetForBucket({
				questionType: 'mcq',
				apClass: 'AP Chemistry',
				generationCountsByClass: counts
			})
		).toBe(15);
	});

	it('uses preferred ceiling when generation stats are empty', () => {
		expect(resolveMcqTarget('AP Biology', {})).toBe(35);
		expect(resolveMcqTarget('AP Chemistry', {})).toBe(20);
	});

	it('ignores non-finite generation counts when scaling', () => {
		expect(
			resolveMcqTarget('AP Chemistry', {
				'AP Biology': Number.NaN,
				'AP Chemistry': 50
			})
		).toBe(20);
	});

	it('detects low-water deficits', () => {
		expect(isBelowLowWater(89, 100, 0.9)).toBe(true);
		expect(isBelowLowWater(90, 100, 0.9)).toBe(false);
		expect(isBelowLowWater(44, 50, 0.9)).toBe(true);
		expect(isBelowLowWater(45, 50, 0.9)).toBe(false);
	});
});
