import { describe, expect, it } from 'vitest';
import { QUESTION_POOL_CONFIG } from '$lib/question-bank/pool-constants';
import { getPoolKindAdapter, POOL_QUESTION_TYPES } from '$lib/question-bank/pool-kinds.server';

describe('question pool kind adapters', () => {
	it('registers only the existing MCQ and FRQ kinds', () => {
		expect(POOL_QUESTION_TYPES).toEqual(['mcq', 'frq']);
	});

	it('keeps worker headroom and target policy behind each adapter', () => {
		const mcq = getPoolKindAdapter('mcq');
		const frq = getPoolKindAdapter('frq');

		expect(mcq.minimumGenerationHeadroomMs).toBe(10_000);
		expect(frq.minimumGenerationHeadroomMs).toBe(35_000);
		expect(
			mcq.targetFor({
				apClass: 'AP Chemistry',
				generationCountsByClass: { 'AP Biology': 100, 'AP Chemistry': 50 }
			})
		).toBe(15);
		expect(
			frq.targetFor({ apClass: 'AP Biology', config: { ...QUESTION_POOL_CONFIG, frqTarget: 4 } })
		).toBe(4);
	});
});
