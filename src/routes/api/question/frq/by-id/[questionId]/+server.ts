import type { RequestHandler } from './$types';
import { getFrqQuestionById } from '#lib/question-bank/frq/model.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { toPublicFrqQuestion } from '#lib/question-bank/frq/types.js';

export const GET: RequestHandler = async ({ params }) => {
	const gated = await requireFrqPracticeEnabled();
	if (gated) return gated;

	const questionId = params.questionId?.trim();
	if (!questionId) {
		return Response.json({ error: 'questionId is required' }, { status: 400 });
	}

	try {
		const question = await getFrqQuestionById(questionId);
		return Response.json({
			question: toPublicFrqQuestion(questionId, question),
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId
		});
	} catch {
		return Response.json({ error: 'Question not found' }, { status: 404 });
	}
};
