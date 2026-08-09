import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/auth/server';
import { getQuestionById } from '$lib/questions/storage.server';
import { logger } from '$lib/server/logger';
import { limitGenericTutor } from '$lib/super/ai-controls.server';
import { tutorGreetingRequestSchema } from '$lib/tutor/chat-request';
import { tutorRateLimitedResponse } from '$lib/tutor/response-utils.server';
import { getGreeting } from '$lib/tutor/service.server';

export const POST: RequestHandler = async (event) => {
	try {
		const parsed = tutorGreetingRequestSchema.safeParse(await event.request.json());
		if (!parsed.success) return json({ error: 'Invalid tutor greeting request' }, { status: 400 });

		const userId =
			event.locals.userId ??
			(await auth.api.getSession({ headers: event.request.headers }))?.user?.id;
		const rate = await limitGenericTutor(event.request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		const question = await getQuestionById(parsed.data.questionId).catch(() => null);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		const message = await getGreeting(question.question);
		return json({ message });
	} catch (error) {
		logger.error('Tutor greeting error', { error });
		return json(
			{
				error: 'Failed to get tutor greeting',
				message: "Hi! I'm here to help you understand this question. What would you like to know?"
			},
			{ status: 500 }
		);
	}
};
