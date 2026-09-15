import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest, type SuperFeature } from '$lib/super/feature-access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-runtime.server';
import { RedisRequiredError } from '$lib/super/ai-controls.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	isSuperAgentToolContinuation,
	superAgentRequestSchema,
	toSuperAgentContext,
	type SuperAgentSurface
} from '$lib/super/agent-request';

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const superAgentRouteConfig = { maxDuration: 60 };

function featureForSurface(surface: SuperAgentSurface): SuperFeature {
	switch (surface) {
		case 'coach':
			return 'coach';
		case 'question':
			return 'personalizedTutor';
		default: {
			const _exhaustive: never = surface;
			return _exhaustive;
		}
	}
}

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
	const access = await authorizeFeatureRequest(event, userId, featureForSurface(context.surface));
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
		let message: string;
		switch (context.surface) {
			case 'coach':
				message = 'Pip needs a student message.';
				break;
			case 'question':
				message = 'The Super Agent needs a student message.';
				break;
			default: {
				const _exhaustive: never = context.surface;
				message = _exhaustive;
			}
		}
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
			let message: string;
			switch (context.surface) {
				case 'coach':
					message = 'Pip is temporarily unavailable. Please try again.';
					break;
				case 'question':
					message = 'Personalized tutoring is temporarily unavailable. Please try again.';
					break;
				default: {
					const _exhaustive: never = context.surface;
					message = _exhaustive;
				}
			}
			return json({ error: message }, { status: 503 });
		}
		throw error;
	}
}
