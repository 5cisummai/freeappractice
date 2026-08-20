import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import { RedisRequiredError } from '$lib/super/ai-controls.server';
import {
	MAX_SUPER_AGENT_MESSAGES,
	MAX_SUPER_AGENT_REQUEST_BYTES,
	coachThinkingModeSchema,
	isSuperAgentToolContinuation,
	superAgentMessageSchema
} from '$lib/super/agent-request';
import { coachComposerActionIds } from '$lib/super/coach-composer-actions';

const coachRequestSchema = z
	.object({
		sessionId: z.string().uuid(),
		conversationId: z.string().uuid().optional(),
		coachActions: z.array(z.enum(coachComposerActionIds)).max(4).optional(),
		thinkingMode: coachThinkingModeSchema.default('quick'),
		context: z
			.object({
				page: z.enum(['coach', 'practice', 'progress', 'history', 'insights']).optional(),
				questionId: z.uuid().optional(),
				questionType: z.enum(['mcq', 'frq']).optional(),
				frqAttemptId: z.string().trim().max(100).optional(),
				quizId: z.uuid().optional()
			})
			.optional(),
		messages: z
			.array(superAgentMessageSchema)
			.min(1)
			.max(MAX_SUPER_AGENT_MESSAGES * 2)
	})
	.strict();

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const config = { maxDuration: 60 };

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) {
			return json({ error: access.message }, { status: access.status });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, MAX_SUPER_AGENT_REQUEST_BYTES);
		} catch (error) {
			return json(
				{
					error:
						error instanceof RequestBodyTooLargeError
							? 'Coach request is too large'
							: 'Invalid Coach request'
				},
				{ status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
			);
		}

		const parsed = coachRequestSchema.safeParse(body);
		if (!parsed.success) return json({ error: 'Invalid Coach request' }, { status: 400 });
		const messages = parsed.data.messages;
		const isContinuation = isSuperAgentToolContinuation(messages);
		if (!isContinuation && !messages.some((message) => message.role === 'user')) {
			return json({ error: 'Coach needs a student message.' }, { status: 400 });
		}

		try {
			return await createSuperAgentStreamResponse({
				event,
				userId,
				sessionId: parsed.data.sessionId,
				conversationId: parsed.data.conversationId,
				coachActions: parsed.data.coachActions,
				thinkingMode: parsed.data.thinkingMode,
				context: {
					mode: 'coach',
					page: 'coach',
					...(parsed.data.context ?? {})
				},
				messages,
				surface: 'coach',
				errorLabel: 'Coach'
			});
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json(
					{ error: 'Coach is temporarily unavailable. Please try again.' },
					{ status: 503 }
				);
			}
			throw error;
		}
	},
	{ logLabel: 'Coach request error', errorMessage: 'Failed to start Coach' }
);
