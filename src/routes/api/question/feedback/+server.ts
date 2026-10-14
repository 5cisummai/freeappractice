import type { RequestHandler } from './$types';
import { submitQuestionFeedback } from '#lib/question-bank/quality/dashboard.server.js';
import { feedbackRequestSchema } from '#lib/question-bank/quality/payloads.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.userId) return Response.json({ message: 'Authentication required' }, { status: 401 });
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return Response.json({ message: 'Request body must be valid JSON' }, { status: 400 });
	}
	const parsed = feedbackRequestSchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ message: 'Invalid feedback request', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const body = parsed.data;

	try {
		return Response.json(
			await submitQuestionFeedback({
				questionId: body.questionId,
				userId: locals.userId,
				type: body.type,
				course: body.course,
				unit: body.unit
			}),
			{ status: 202 }
		);
	} catch (error) {
		return Response.json(
			{ message: error instanceof Error ? error.message : 'Unable to save feedback' },
			{ status: 400 }
		);
	}
};
