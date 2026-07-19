import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitQuestionFeedback } from '$lib/question-quality/dashboard.server';
import type { FeedbackType } from '$lib/question-quality/types';

const VALID_TYPES = new Set<FeedbackType>([
	'answer_incorrect',
	'question_unclear',
	'explanation_unclear'
]);

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.userId) return json({ message: 'Authentication required' }, { status: 401 });
	const body = (await request.json()) as {
		questionId?: string;
		type?: FeedbackType;
		apClass?: string;
		unit?: string;
	};
	if (!body.questionId?.trim() || !body.type || !VALID_TYPES.has(body.type)) {
		return json({ message: 'A valid questionId and feedback type are required' }, { status: 400 });
	}

	try {
		return json(
			await submitQuestionFeedback({
				questionId: body.questionId,
				userId: locals.userId,
				type: body.type,
				apClass: body.apClass,
				unit: body.unit
			}),
			{ status: 202 }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Unable to save feedback' },
			{ status: 400 }
		);
	}
};
