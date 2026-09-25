import { describe, expect, it } from 'vitest';
import { isValidPoolBucket } from '$lib/question-bank/pool-refill-queue.server';

describe('pool refill bucket validation', () => {
	it('accepts only catalog course and unit buckets', () => {
		expect(
			isValidPoolBucket({
				course: ' AP Physics C: Mechanics ',
				unit: ' Unit 1: Kinematics '
			})
		).toBe(true);
		expect(
			isValidPoolBucket({
				course: 'AP Physics C: Mechanics',
				unit: 'Unit 99: Does Not Exist'
			})
		).toBe(false);
		expect(
			isValidPoolBucket({
				course: 'AP Lunch😂',
				unit: 'Unit 1: Cafeteria Line Dynamics'
			})
		).toBe(false);
	});

	it('pools task courses by format and unit courses by catalog unit', () => {
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				course: 'AP English Language',
				unit: 'synthesis'
			})
		).toBe(true);
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				course: 'AP English Language',
				unit: 'Unit 1: The Rhetorical Situation'
			})
		).toBe(false);
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				course: 'AP Biology',
				unit: 'Unit 1: Chemistry of Life'
			})
		).toBe(true);
		expect(
			isValidPoolBucket({
				questionType: 'frq',
				course: 'AP Biology',
				unit: 'long-experimental-analysis'
			})
		).toBe(false);
		expect(
			isValidPoolBucket({
				questionType: 'mcq',
				course: 'AP Biology',
				unit: 'Unit 1: Chemistry of Life'
			})
		).toBe(true);
	});
});
