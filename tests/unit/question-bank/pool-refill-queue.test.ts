import { describe, expect, it } from 'vitest';
import { isValidPoolBucket } from '$lib/question-bank/pool-refill-queue.server';

describe('pool refill bucket validation', () => {
	it('accepts only catalog course and unit buckets', () => {
		expect(
			isValidPoolBucket({
				apClass: ' AP Physics C: Mechanics ',
				unit: ' Unit 1: Kinematics '
			})
		).toBe(true);
		expect(
			isValidPoolBucket({
				apClass: 'AP Physics C: Mechanics',
				unit: 'Unit 99: Does Not Exist'
			})
		).toBe(false);
		expect(
			isValidPoolBucket({
				apClass: 'AP Lunch😂',
				unit: 'Unit 1: Cafeteria Line Dynamics'
			})
		).toBe(false);
	});

	it('rejects FRQ buckets for courses that are not enabled', () => {
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				apClass: 'AP English Language',
				unit: 'Unit 1: The Rhetorical Situation'
			})
		).toBe(true);
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				apClass: 'AP Biology',
				unit: 'Unit 1: Chemistry of Life'
			})
		).toBe(false);
		expect(
			isValidPoolBucket({
				questionType: 'mcq',
				apClass: 'AP Biology',
				unit: 'Unit 1: Chemistry of Life'
			})
		).toBe(true);
	});
});
