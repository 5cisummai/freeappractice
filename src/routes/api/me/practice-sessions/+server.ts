import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	resolvePracticeContext,
	startPracticeSession
} from '#lib/users/practice-context.server.js';

const inputSchema = z
	.object({
		mode: z.enum(['mcq', 'quiz', 'frq', 'exam']),
		course: z.string().trim().min(1).max(120).nullable().optional(),
		organizationId: z.string().trim().min(1).nullable().optional(),
		questionRefs: z
			.array(
				z.object({
					questionId: z.string().trim().min(1),
					questionType: z.enum(['mcq', 'frq'])
				})
			)
			.max(200)
			.default([])
	})
	.strict();

export const POST = withAuthedHandler(
	async (event, userId) => {
		const parsed = inputSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) {
			return Response.json({ error: 'Invalid practice session.' }, { status: 400 });
		}
		const context = await resolvePracticeContext(userId, parsed.data.organizationId);
		const session = await startPracticeSession(
			userId,
			parsed.data.mode,
			context,
			parsed.data.questionRefs,
			parsed.data.course ?? null
		);
		return Response.json({
			practiceSessionId: session.id,
			organizationId: session.organizationId,
			mode: session.mode,
			course: session.course,
			startedAt: session.startedAt.toISOString()
		});
	},
	{ logLabel: 'Practice session start error', errorMessage: 'Failed to start practice session' }
);
