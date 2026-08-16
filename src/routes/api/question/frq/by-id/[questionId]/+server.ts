import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFrqQuestionById } from '$lib/question-bank/frq/model.server';
import { requireFrqPracticeEnabled } from '$lib/question-bank/frq/gate.server';
import { toPublicFrqQuestion } from '$lib/question-bank/frq/types';

export const GET: RequestHandler = async ({ params }) => {
	const gated = await requireFrqPracticeEnabled();
	if (gated) return gated;

	const questionId = params.questionId?.trim();
	if (!questionId) {
		return json({ error: 'questionId is required' }, { status: 400 });
	}

	try {
		const question = await getFrqQuestionById(questionId);
		return json({
			question: toPublicFrqQuestion(questionId, question),
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId
		});
	} catch {
		return json({ error: 'Question not found' }, { status: 404 });
	}
};
