import type { RequestHandler } from './$types';
import { getOptionalUserId } from '#lib/auth/route-helpers.server.js';
import { resolveTutorQuestion } from '#lib/tutor/service.server.js';
import { logger } from '#lib/server/logger.js';
import { limitGenericTutor } from '#lib/tutor/rate-limit.server.js';
import { tutorGreetingRequestSchema } from '#lib/tutor/chat-request.js';
import { tutorRateLimitedResponse } from '#lib/tutor/response-utils.server.js';
import { getGreeting } from '#lib/tutor/service.server.js';
import { getAssistantFeaturesEnabledForRequest } from '#lib/users/assistant-preferences.server.js';

export const POST: RequestHandler = async (event) => {
	try {
		const parsed = tutorGreetingRequestSchema.safeParse(await event.request.json());
		if (!parsed.success)
			return Response.json({ error: 'Invalid tutor greeting request' }, { status: 400 });

		const userId = await getOptionalUserId(event);
		if (userId && !(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return Response.json(
				{ error: 'Assistant features are disabled for this account.' },
				{ status: 403 }
			);
		}
		const rate = await limitGenericTutor(event.request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		const question = await resolveTutorQuestion(parsed.data.questionId);
		if (!question) return Response.json({ error: 'Question not found' }, { status: 404 });

		const message = await getGreeting(question.question);
		return Response.json({ message });
	} catch (error) {
		logger.error('Tutor greeting error', { error });
		return Response.json(
			{
				error: 'Failed to get tutor greeting',
				message: "Hi! I'm here to help you understand this question. What would you like to know?"
			},
			{ status: 500 }
		);
	}
};
