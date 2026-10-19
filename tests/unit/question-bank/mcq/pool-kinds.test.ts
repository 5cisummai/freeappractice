import { describe, expect, it } from 'vitest';
import { QUESTION_POOL_CONFIG } from '#lib/question-bank/pool-constants.js';
import { getPoolKindAdapter } from '#lib/question-bank/pool-kinds.server.js';

describe('question pool kind adapters', () => {
	it('keeps worker headroom and target policy behind each adapter', () => {
		const mcq = getPoolKindAdapter('mcq');
		const frq = getPoolKindAdapter('frq');

		expect(mcq.minimumGenerationHeadroomMs).toBe(10_000);
		expect(frq.minimumGenerationHeadroomMs).toBe(35_000);
		expect(
			mcq.targetFor({
				course: 'AP Chemistry',
				generationCountsByCourse: { 'AP Biology': 100, 'AP Chemistry': 50 }
			})
		).toBe(18);
		expect(
			frq.targetFor({ course: 'AP Biology', config: { ...QUESTION_POOL_CONFIG, frqTarget: 4 } })
		).toBe(4);
	});
});
