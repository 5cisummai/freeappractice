import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestionById } from '$lib/question-bank/mcq/repository.server';
import { storedQuestionToMcqAnswerBody } from '$lib/question-bank/mcq/public-payload.server';

export const GET: RequestHandler = async ({ params }) => {
	const questionId = params.questionId?.trim();
	if (!questionId) {
		return json({ error: 'questionId is required' }, { status: 400 });
	}

	try {
		const question = await getQuestionById(questionId);
		return json({
			answer: storedQuestionToMcqAnswerBody(question),
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId: question.id
		});
	} catch {
		return json({ error: 'Question not found' }, { status: 404 });
	}
};
