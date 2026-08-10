import { describe, expect, it } from 'vitest';
import {
	InvalidQualityTransitionError,
	transitionReviewItemStatus,
	transitionReviewJobStatus,
	transitionQualityState
} from '$lib/question-quality/transitions';

describe('question quality state transitions', () => {
	it('allows the documented job lifecycle', () => {
		expect(transitionReviewJobStatus('preview', 'activate')).toBe('preparing');
		expect(transitionReviewJobStatus('preparing', 'start')).toBe('in_progress');
		expect(transitionReviewJobStatus('in_progress', 'pause')).toBe('paused');
		expect(transitionReviewJobStatus('paused', 'resume')).toBe('preparing');
		expect(transitionReviewJobStatus('awaiting_human', 'complete')).toBe('completed');
	});

	it('rejects terminal and impossible transitions', () => {
		expect(() => transitionReviewJobStatus('completed', 'pause')).toThrow(
			InvalidQualityTransitionError
		);
		expect(() => transitionReviewItemStatus('final', 'retry')).toThrow(
			InvalidQualityTransitionError
		);
	});

	it('requires an explicit item transition for every processing outcome', () => {
		expect(transitionReviewItemStatus('queued', 'prepare')).toBe('preparing');
		expect(transitionReviewItemStatus('preparing', 'submit')).toBe('submitted');
		expect(transitionReviewItemStatus('submitted', 'await_human')).toBe('awaiting_human');
		expect(transitionReviewItemStatus('awaiting_human', 'finalize')).toBe('final');
	});

	it('keeps question quality state progression one-way', () => {
		expect(transitionQualityState('unreviewed', 'assess_for_human')).toBe('awaiting_human');
		expect(transitionQualityState('awaiting_human', 'finalize')).toBe('final');
		expect(() => transitionQualityState('final', 'assess_for_human')).toThrow(
			InvalidQualityTransitionError
		);
	});
});
