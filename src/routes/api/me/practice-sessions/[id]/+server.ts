import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	finishPracticeSession,
	requirePracticeSession
} from '#lib/users/practice-context.server.js';

const inputSchema = z
	.object({ status: z.enum(['completed', 'cancelled']).default('completed') })
	.strict();

export const GET = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return Response.json({ error: 'Session ID is required.' }, { status: 400 });
		const session = await requirePracticeSession(userId, id);
		return Response.json({
			practiceSessionId: session.id,
			organizationId: session.organizationId,
			mode: session.mode,
			course: session.course,
			status: session.status,
			startedAt: session.startedAt.toISOString(),
			questionRefs: session.questionRefs
		});
	},
	{ logLabel: 'Practice session lookup error', errorMessage: 'Failed to load practice session' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return Response.json({ error: 'Session ID is required.' }, { status: 400 });
		const parsed = inputSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'Invalid session update.' }, { status: 400 });
		await finishPracticeSession(userId, id, parsed.data.status);
		return Response.json({ message: 'Practice session updated.' });
	},
	{ logLabel: 'Practice session update error', errorMessage: 'Failed to update practice session' }
);
