import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqFromS3 } from '$lib/frq/storage.server';
import { chatFrq } from '$lib/tutor/service.server';
import { createFrqTutorChatStream } from '$lib/tutor/chat-stream.server';
import { frqTutorChatRequestSchema, TUTOR_CHAT_STREAM_TIMEOUT_MS } from '$lib/tutor/chat-request';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isFrqPracticeEnabled())) {
			return json({ error: 'Written-response practice is unavailable' }, { status: 404 });
		}

		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
			return json({ error: 'Invalid tutor chat request' }, { status: 400 });
		}
		const result = frqTutorChatRequestSchema.safeParse(body);
		if (!result.success) {
			return json(
				{
					error: 'Invalid tutor chat request',
					details: result.error.issues.map((issue) => issue.message)
				},
				{ status: 400 }
			);
		}

		const question = await getFrqFromS3(result.data.questionId);
		if (!getFrqCourseProfile(question.apClass)) {
			return json(
				{ error: 'Written-response practice is unavailable for this course' },
				{ status: 404 }
			);
		}

		let attempt = null;
		if (result.data.attemptId) {
			attempt = await getFrqAttemptForUser(userId, result.data.attemptId);
			if (!attempt || attempt.questionId !== result.data.questionId) {
				return json({ error: 'Written-response attempt not found' }, { status: 404 });
			}
		}

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'frq_tutor_chat_started',
			properties: {
				ap_class: question.apClass,
				unit: question.unit,
				has_submission: Boolean(attempt),
				has_prior_conversation: result.data.conversationHistory.length > 0
			}
		});

		const stream = createFrqTutorChatStream(
			{ question, attempt },
			result.data,
			event.request.signal,
			{ chatImpl: chatFrq, timeoutMs: TUTOR_CHAT_STREAM_TIMEOUT_MS }
		);
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	},
	{ logLabel: 'FRQ tutor chat error', errorMessage: 'Failed to start FRQ tutor chat' }
);
