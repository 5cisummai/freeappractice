import { describe, expect, it } from 'vitest';
import { getStimulusPolicy } from '#lib/question-bank/mcq/stimulus-policy.js';
import { estimateMcqPoolGenerationSlots } from '#lib/question-bank/pool-kind-worker.server.js';

describe('MCQ pool slot estimates', () => {
	const policy = getStimulusPolicy('AP Biology');

	it('reserves a stimulus set when the discrete deficit is large enough', () => {
		expect(
			estimateMcqPoolGenerationSlots({
				target: 20,
				activeCount: 0,
				activeDiscreteCount: 0,
				policy
			})
		).toBe(4);
	});

	it('stays at one slot when stimulus coverage is already at the quiz target', () => {
		expect(
			estimateMcqPoolGenerationSlots({
				target: 20,
				activeCount: 20,
				activeDiscreteCount: 15,
				policy
			})
		).toBe(1);
	});
});
