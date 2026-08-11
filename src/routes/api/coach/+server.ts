import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperCoachEnabled } from '$lib/flags';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import { RedisRequiredError } from '$lib/super/ai-controls.server';
import type { SuperAgentRequest } from '$lib/super/agent-request';

const MAX_COACH_REQUEST_BYTES = 2048 * 1024;
const coachMessagePartSchema = z
	.object({ type: z.string().min(1).max(100), text: z.string().max(2_000).optional() })
	.passthrough();
const coachRequestSchema = z
	.object({
		sessionId: z.string().uuid(),
		conversationId: z.string().uuid().optional(),
		context: z
			.object({
				page: z.enum(['coach', 'practice', 'progress', 'history', 'insights']).optional(),
				questionId: z.string().uuid().optional(),
				questionType: z.enum(['mcq', 'frq']).optional(),
				frqAttemptId: z.string().trim().max(100).optional(),
				quizId: z.string().uuid().optional()
			})
			.optional(),
		messages: z
			.array(
				z
					.object({
						id: z.string().max(200).optional(),
						role: z.enum(['user', 'assistant']),
						parts: z.array(coachMessagePartSchema).max(24)
					})
					.passthrough()
			)
			.min(1)
			.max(24)
	})
	.strict();

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const config = { maxDuration: 60 };

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperCoachEnabled())) {
			return json({ error: 'Coach is temporarily unavailable.' }, { status: 503 });
		}
		const access = await getSuperFeatureAccess(userId, 'coach');
		if (!access.allowed) {
			return json({ error: superFeatureAccessMessage(access, 'Coach') }, { status: 403 });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, MAX_COACH_REQUEST_BYTES);
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
		const messages = parsed.data.messages as SuperAgentRequest['messages'];
		if (!messages.some((message) => message.role === 'user')) {
			return json({ error: 'Coach needs a student message.' }, { status: 400 });
		}

		try {
			return await createSuperAgentStreamResponse({
				event,
				userId,
				sessionId: parsed.data.sessionId,
				conversationId: parsed.data.conversationId,
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
