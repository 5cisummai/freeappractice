import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { createAgentStreamResponse } from '#lib/agent/stream.server.js';
import { RedisRequiredError } from '#lib/agent/usage/controls.server.js';
import {
	MAX_AGENT_REQUEST_BYTES,
	isAgentToolContinuation,
	agentRequestSchema
} from '#lib/agent/request.js';

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const agentRouteConfig = { maxDuration: 60 };

export async function handleAgentPost(event: RequestEvent, userId: string): Promise<Response> {
	let body: unknown;
	try {
		body = await readJsonBody(event.request, MAX_AGENT_REQUEST_BYTES);
	} catch (error) {
		return Response.json(
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
		return Response.json(
			{ error: 'Question tutoring is no longer available on this endpoint.' },
			{ status: 404 }
		);
	}
	const parsed = agentRequestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: 'Invalid Super Agent request' }, { status: 400 });
	}

	const { context, messages, sessionId, conversationId, coachActions, thinkingMode } = parsed.data;
	const access = await authorizeFeatureRequest(event, userId, 'coach');
	if (!access.allowed) {
		return Response.json({ error: access.message }, { status: access.status });
	}

	const isContinuation = isAgentToolContinuation(messages);
	if (!isContinuation && !messages.some((message) => message.role === 'user')) {
		return Response.json({ error: 'Pip needs a student message.' }, { status: 400 });
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
			return Response.json(
				{ error: 'Pip is temporarily unavailable. Please try again.' },
				{ status: 503 }
			);
		}
		throw error;
	}
}
