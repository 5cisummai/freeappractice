import { describe, expect, it } from 'vitest';
import {
	feedbackRequestSchema,
	questionQualityRequestSchema
} from '$lib/question-quality/payloads';

describe('question quality request validation', () => {
	it('accepts known actions with bounded fields', () => {
		expect(
			questionQualityRequestSchema.safeParse({
				action: 'humanDecision',
				questionId: 'q-1',
				verdict: 'good',
				notes: 'Looks correct'
			}).success
		).toBe(true);
	});

	it('rejects malformed identifiers and unknown actions', () => {
		expect(questionQualityRequestSchema.safeParse({ action: 'refresh', jobId: '' }).success).toBe(
			false
		);
		expect(
			questionQualityRequestSchema.safeParse({ action: 'delete', jobId: 'job-1' }).success
		).toBe(false);
	});

	it('rejects unknown feedback fields and invalid feedback types', () => {
		expect(feedbackRequestSchema.safeParse({ questionId: 'q-1', type: 'nope' }).success).toBe(
			false
		);
		expect(
			feedbackRequestSchema.safeParse({ questionId: 'q-1', type: 'answer_incorrect', extra: true })
				.success
		).toBe(false);
	});
});
