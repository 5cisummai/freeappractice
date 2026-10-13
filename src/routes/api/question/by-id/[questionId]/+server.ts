import type { RequestHandler } from './$types';
import { getQuestionById } from '#lib/question-bank/mcq/repository.server.js';
import { storedQuestionToMcqAnswerBody } from '#lib/question-bank/mcq/public-payload.server.js';

export const GET: RequestHandler = async ({ params }) => {
	const questionId = params.questionId?.trim();
	if (!questionId) {
		return Response.json({ error: 'questionId is required' }, { status: 400 });
	}

	try {
		const question = await getQuestionById(questionId);
		return Response.json({
			answer: storedQuestionToMcqAnswerBody(question),
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId: question.id
		});
	} catch {
		return Response.json({ error: 'Question not found' }, { status: 404 });
	}
};
