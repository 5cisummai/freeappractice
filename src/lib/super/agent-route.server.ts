import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-runtime.server';
import { RedisRequiredError } from '$lib/super/ai-controls.server';
import {
	MAX_SUPER_AGENT_MESSAGES,
	MAX_SUPER_AGENT_REQUEST_BYTES,
	isSuperAgentToolContinuation,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const superAgentRouteConfig = { maxDuration: 60 };

export async function handleSuperAgentPost(
	event: RequestEvent,
	userId: string
): Promise<Response> {
	let body: unknown;
	try {
		body = await readJsonBody(event.request, MAX_SUPER_AGENT_REQUEST_BYTES);
	} catch (error) {
		return json(
			{
				error:
					error instanceof RequestBodyTooLargeError
						? 'Super Agent request is too large'
						: 'Invalid Super Agent request'
			},
			{ status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
		);
	}

	const parsed = superAgentRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Invalid Super Agent request' }, { status: 400 });
	}

	const { context, messages, sessionId, conversationId, coachActions, thinkingMode } = parsed.data;
	const feature = context.surface === 'coach' ? 'coach' : 'personalizedTutor';
	const access = await authorizeFeatureRequest(event, userId, feature);
	if (!access.allowed) {
		return json({ error: access.message }, { status: access.status });
	}

	if (context.surface === 'question') {
		if (!context.questionId || !context.questionType) {
			return json({ error: 'A current question is required for Super Tutor.' }, { status: 400 });
		}
	}

	const isContinuation = isSuperAgentToolContinuation(messages);
	if (!isContinuation && !messages.some((message) => message.role === 'user')) {
		const message =
			context.surface === 'coach'
				? 'Pip needs a student message.'
				: 'The Super Agent needs a student message.';
		return json({ error: message }, { status: 400 });
	}

	try {
		return await createSuperAgentStreamResponse({
			event,
			userId,
			sessionId,
			conversationId,
			coachActions,
			thinkingMode,
			context: toSuperAgentContext(context),
			messages
		});
	} catch (error) {
		if (error instanceof RedisRequiredError) {
			const message =
				context.surface === 'coach'
					? 'Pip is temporarily unavailable. Please try again.'
					: 'Personalized tutoring is temporarily unavailable. Please try again.';
			return json({ error: message }, { status: 503 });
		}
		throw error;
	}
}
