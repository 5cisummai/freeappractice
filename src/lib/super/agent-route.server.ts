import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-runtime.server';
import { RedisRequiredError } from '$lib/super/ai-controls.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	isSuperAgentToolContinuation,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const superAgentRouteConfig = { maxDuration: 60 };

export async function handleSuperAgentPost(event: RequestEvent, userId: string): Promise<Response> {
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
	if (context.surface !== 'coach') {
		return json(
			{ error: 'Question tutoring is no longer available on this endpoint.' },
			{ status: 404 }
		);
	}
	const access = await authorizeFeatureRequest(event, userId, 'coach');
	if (!access.allowed) {
		return json({ error: access.message }, { status: access.status });
	}

	const isContinuation = isSuperAgentToolContinuation(messages);
	if (!isContinuation && !messages.some((message) => message.role === 'user')) {
		return json({ error: 'Pip needs a student message.' }, { status: 400 });
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
			return json({ error: 'Pip is temporarily unavailable. Please try again.' }, { status: 503 });
		}
		throw error;
	}
}
