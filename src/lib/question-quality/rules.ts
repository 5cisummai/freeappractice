import { createHash } from 'node:crypto';
import type { AiQualityAssessment, FeedbackSummary, FeedbackType } from './types.js';
import { hasOfficialApSource } from './rubric.server.js';

export const DEFAULT_INPUT_TOKENS_PER_QUESTION = 4_000;
export const DEFAULT_OUTPUT_TOKENS_PER_QUESTION = 800;

export function feedbackSummaryFromCounts(
	counts: Partial<Record<FeedbackType, number>>
): FeedbackSummary {
	const answerIncorrect = counts.answer_incorrect ?? 0;
	const questionUnclear = counts.question_unclear ?? 0;
	const explanationUnclear = counts.explanation_unclear ?? 0;
	const uniqueReporters = Math.max(answerIncorrect, questionUnclear, explanationUnclear);
	const high = answerIncorrect >= 2 || questionUnclear >= 3 || explanationUnclear >= 3;
	const any = answerIncorrect + questionUnclear + explanationUnclear > 0;

	return {
		answerIncorrect,
		questionUnclear,
		explanationUnclear,
		uniqueReporters,
		priority: high ? 'high' : any ? 'normal' : 'none'
	};
}

export function isCalibrationSample(questionId: string, rubricVersion: string): boolean {
	const digest = createHash('sha256').update(`${rubricVersion}:${questionId}`).digest();
	return digest.readUInt32BE(0) % 100 < 5;
}

export function shouldRequireHumanReview(opts: {
	assessment: AiQualityAssessment;
	feedback: FeedbackSummary;
	calibrated: boolean;
	confidenceThreshold: number;
	calibrationSample: boolean;
	webSearchRequired?: boolean;
	webSearchUsed?: boolean;
	sourceUrls?: string[];
}): { required: boolean; reason: string } {
	if (!opts.calibrated) return { required: true, reason: 'agent_not_calibrated' };
	if (opts.feedback.priority === 'high')
		return { required: true, reason: 'student_feedback_escalation' };
	if (opts.assessment.requiresHumanReview)
		return { required: true, reason: 'agent_requested_human' };
	if (
		opts.webSearchRequired &&
		(!opts.webSearchUsed || !hasOfficialApSource(opts.sourceUrls ?? []))
	)
		return { required: true, reason: 'web_evidence_missing' };
	if (opts.assessment.confidence < opts.confidenceThreshold) {
		return { required: true, reason: 'low_confidence' };
	}
	if (opts.calibrationSample) return { required: true, reason: 'calibration_sample' };
	return { required: false, reason: 'confident_ai' };
}

export function estimateCostUsd(
	inputTokens: number,
	outputTokens: number,
	inputUsdPerMillion: number,
	outputUsdPerMillion: number
): number {
	return (
		(inputTokens / 1_000_000) * inputUsdPerMillion +
		(outputTokens / 1_000_000) * outputUsdPerMillion
	);
}

export function estimateBatchCost(opts: {
	count: number;
	inputTokensPerQuestion?: number;
	outputTokensPerQuestion?: number;
	inputUsdPerMillion: number;
	outputUsdPerMillion: number;
}) {
	const estimatedInputTokens =
		opts.count * (opts.inputTokensPerQuestion ?? DEFAULT_INPUT_TOKENS_PER_QUESTION);
	const estimatedOutputTokens =
		opts.count * (opts.outputTokensPerQuestion ?? DEFAULT_OUTPUT_TOKENS_PER_QUESTION);
	return {
		estimatedInputTokens,
		estimatedOutputTokens,
		estimatedMaximumCostUsd: estimateCostUsd(
			estimatedInputTokens,
			estimatedOutputTokens,
			opts.inputUsdPerMillion,
			opts.outputUsdPerMillion
		)
	};
}
