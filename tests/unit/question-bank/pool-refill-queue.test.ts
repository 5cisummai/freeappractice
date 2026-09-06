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
});
