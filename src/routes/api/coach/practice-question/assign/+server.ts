import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { readJsonBody } from '#lib/server/request-body.server.js';
import { getCoachPracticeQuestionOutput } from '#lib/agent/tools/practice.js';
import {
	assignCoachPracticeQuestionToToolPart,
	ConversationAccessError
} from '#lib/agent/conversations/store.server.js';

const assignPracticeQuestionSchema = z
	.object({
		conversationId: z.string().trim().min(1).max(128),
		toolCallId: z.string().trim().min(1).max(256),
		assignedQuestion: z.unknown()
	})
	.strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) {
			return Response.json({ error: access.message }, { status: access.status });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, 64 * 1024);
		} catch {
			return Response.json({ error: 'Invalid practice question assignment' }, { status: 400 });
		}

		const parsed = assignPracticeQuestionSchema.safeParse(body);
		if (!parsed.success) {
			return Response.json({ error: 'Invalid practice question assignment' }, { status: 400 });
		}

		const assignedQuestion = getCoachPracticeQuestionOutput(parsed.data.assignedQuestion);
		if (!assignedQuestion) {
			return Response.json({ error: 'Invalid practice question assignment' }, { status: 400 });
		}

		try {
			await assignCoachPracticeQuestionToToolPart(userId, {
				conversationId: parsed.data.conversationId,
				toolCallId: parsed.data.toolCallId,
				assignedQuestion
			});
		} catch (error) {
			if (error instanceof ConversationAccessError) {
				return Response.json({ error: error.message }, { status: error.status });
			}
			throw error;
		}

		return Response.json({ ok: true });
	},
	{
		logLabel: 'Coach practice question assign error',
		errorMessage: 'Failed to save practice question'
	}
);
