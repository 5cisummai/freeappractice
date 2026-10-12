import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest } from '$lib/agent/access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createAgentStreamResponse } from '$lib/agent/stream.server';
import { RedisRequiredError } from '$lib/agent/usage/controls.server';
import {
	MAX_AGENT_REQUEST_BYTES,
	isAgentToolContinuation,
	agentRequestSchema
} from '$lib/agent/request';

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const agentRouteConfig = { maxDuration: 60 };

export async function handleAgentPost(event: RequestEvent, userId: string): Promise<Response> {
	let body: unknown;
	try {
		body = await readJsonBody(event.request, MAX_AGENT_REQUEST_BYTES);
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

	if (
		body &&
		typeof body === 'object' &&
		'context' in body &&
		(body.context as { surface?: unknown })?.surface === 'question'
	) {
		return json(
			{ error: 'Question tutoring is no longer available on this endpoint.' },
			{ status: 404 }
		);
	}
	const parsed = agentRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Invalid Super Agent request' }, { status: 400 });
	}

	const { context, messages, sessionId, conversationId, coachActions, thinkingMode } = parsed.data;
	const access = await authorizeFeatureRequest(event, userId, 'coach');
	if (!access.allowed) {
		return json({ error: access.message }, { status: access.status });
	}

	const isContinuation = isAgentToolContinuation(messages);
	if (!isContinuation && !messages.some((message) => message.role === 'user')) {
		return json({ error: 'Pip needs a student message.' }, { status: 400 });
	}

	try {
		return await createAgentStreamResponse({
			event,
			userId,
			sessionId,
			accessReason: access.planAccess.accessReason ?? 'subscription',
			conversationId,
			coachActions,
			thinkingMode,
			context,
			messages
		});
	} catch (error) {
		if (error instanceof RedisRequiredError) {
			return json({ error: 'Pip is temporarily unavailable. Please try again.' }, { status: 503 });
		}
		throw error;
	}
}
