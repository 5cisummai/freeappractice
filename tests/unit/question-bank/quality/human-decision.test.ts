import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getQuestionQuality: vi.fn(),
	updateQuestionQuality: vi.fn()
}));

vi.mock('#lib/question-bank/quality/models.server.js', () => ({
	ensureQuestionQuality: vi.fn(),
	getQuestionQuality: mocks.getQuestionQuality,
	updateQuestionQuality: mocks.updateQuestionQuality,
	updateReviewJobItemByQuestion: vi.fn()
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		insert: () => ({ values: vi.fn() }),
		execute: vi.fn(),
		batch: vi.fn()
	})
}));

import { recordHumanDecision } from '#lib/question-bank/quality/service.server.js';

it('closes a reopened report when a reviewer reaffirms the existing verdict', async () => {
	mocks.getQuestionQuality.mockResolvedValue({
		state: 'final',
		finalVerdict: 'good',
		needsHumanReview: true
	});
	mocks.updateQuestionQuality.mockResolvedValue({ matchedCount: 1 });

	await recordHumanDecision({
		questionId: 'question-1',
		verdict: 'good',
		notes: 'Verified the answer.',
		reviewerId: 'reviewer-1'
	});

	expect(mocks.updateQuestionQuality).toHaveBeenCalledWith(
		'question-1',
		expect.objectContaining({
			finalVerdict: 'good',
			needsHumanReview: false,
			humanReviewReason: null,
			humanAssessment: expect.objectContaining({ notes: 'Verified the answer.' })
		})
	);
});
