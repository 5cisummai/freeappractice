import { describe, expect, it } from 'vitest';
import { estimateBiologyScore } from '#lib/exams/score-estimate.js';

describe('Biology practice score estimate', () => {
	it.each([
		[0, 1],
		[29, 1],
		[30, 2],
		[53, 2],
		[54, 3],
		[74, 3],
		[75, 4],
		[92, 4],
		[93, 5],
		[120, 5]
	])('maps a %i-point composite to a %i', (composite, band) => {
		const mcqCorrect = Math.min(composite, 60);
		expect(
			estimateBiologyScore({
				mcqCorrect,
				mcqTotal: 60,
				frqEarned: composite - mcqCorrect,
				frqAvailable: 60
			})
		).toBe(band);
	});

	it('weights each section equally even when their raw totals differ', () => {
		expect(
			estimateBiologyScore({
				mcqCorrect: 60,
				mcqTotal: 60,
				frqEarned: 0,
				frqAvailable: 34
			})
		).toBe(3);
	});

	it('requires a usable score from both sections', () => {
		expect(
			estimateBiologyScore({
				mcqCorrect: 30,
				mcqTotal: 60,
				frqEarned: 0,
				frqAvailable: 0
			})
		).toBeNull();
	});
});
