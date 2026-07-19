import { describe, expect, it } from 'vitest';
import {
	estimateBatchCost,
	estimateCostUsd,
	feedbackSummaryFromCounts,
	isCalibrationSample,
	shouldRequireHumanReview
} from '$lib/question-quality/rules';
import type { AiQualityAssessment } from '$lib/question-quality/types';

const assessment: AiQualityAssessment = {
	verdict: 'good',
	issueCodes: [],
	evidence: ['The keyed answer follows from the prompt.'],
	sourceUrls: ['https://apcentral.collegeboard.org/example'],
	webSearchUsed: true,
	confidence: 0.95,
	requiresHumanReview: false,
	model: 'test-model',
	rubricVersion: 'test-rubric',
	reviewedAt: new Date(),
	usage: { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.01 }
};

describe('question quality rules', () => {
	it('escalates at the independent student-feedback thresholds', () => {
		expect(feedbackSummaryFromCounts({ answer_incorrect: 1 }).priority).toBe('normal');
		expect(feedbackSummaryFromCounts({ answer_incorrect: 2 }).priority).toBe('high');
		expect(feedbackSummaryFromCounts({ question_unclear: 2 }).priority).toBe('normal');
		expect(feedbackSummaryFromCounts({ question_unclear: 3 }).priority).toBe('high');
		expect(feedbackSummaryFromCounts({ explanation_unclear: 3 }).priority).toBe('high');
	});

	it('keeps all results human-only before calibration', () => {
		expect(
			shouldRequireHumanReview({
				assessment,
				feedback: feedbackSummaryFromCounts({}),
				calibrated: false,
				confidenceThreshold: 0.85,
				calibrationSample: false
			})
		).toEqual({ required: true, reason: 'agent_not_calibrated' });
	});

	it('requires review for feedback conflicts, low confidence, and calibration samples', () => {
		expect(
			shouldRequireHumanReview({
				assessment,
				feedback: feedbackSummaryFromCounts({ answer_incorrect: 2 }),
				calibrated: true,
				confidenceThreshold: 0.85,
				calibrationSample: false
			}).reason
		).toBe('student_feedback_escalation');
		expect(
			shouldRequireHumanReview({
				assessment: { ...assessment, confidence: 0.8 },
				feedback: feedbackSummaryFromCounts({}),
				calibrated: true,
				confidenceThreshold: 0.85,
				calibrationSample: false
			}).reason
		).toBe('low_confidence');
		expect(
			shouldRequireHumanReview({
				assessment,
				feedback: feedbackSummaryFromCounts({}),
				calibrated: true,
				confidenceThreshold: 0.85,
				calibrationSample: true
			}).reason
		).toBe('calibration_sample');
	});

	it('requires review when a real AP item lacks official web evidence', () => {
		expect(
			shouldRequireHumanReview({
				assessment,
				feedback: feedbackSummaryFromCounts({}),
				calibrated: true,
				confidenceThreshold: 0.85,
				calibrationSample: false,
				webSearchRequired: true,
				webSearchUsed: true,
				sourceUrls: ['https://example.edu/fact']
			}).reason
		).toBe('web_evidence_missing');
	});

	it('uses a stable five-percent calibration decision', () => {
		const first = Array.from({ length: 1_000 }, (_, index) =>
			isCalibrationSample(`question-${index}`, 'rubric-v1')
		);
		const second = Array.from({ length: 1_000 }, (_, index) =>
			isCalibrationSample(`question-${index}`, 'rubric-v1')
		);
		expect(second).toEqual(first);
		expect(first.filter(Boolean).length).toBeGreaterThanOrEqual(35);
		expect(first.filter(Boolean).length).toBeLessThanOrEqual(65);
	});

	it('calculates the conservative batch preview from configurable rates', () => {
		expect(
			estimateBatchCost({
				count: 100,
				inputTokensPerQuestion: 2_000,
				outputTokensPerQuestion: 500,
				inputUsdPerMillion: 1,
				outputUsdPerMillion: 4
			})
		).toEqual({
			estimatedInputTokens: 200_000,
			estimatedOutputTokens: 50_000,
			estimatedMaximumCostUsd: 0.4
		});
	});

	it('shares the same USD formula for raw token totals', () => {
		expect(estimateCostUsd(200_000, 50_000, 1, 4)).toBe(0.4);
		expect(estimateCostUsd(0, 0, 1, 4)).toBe(0);
	});
});
