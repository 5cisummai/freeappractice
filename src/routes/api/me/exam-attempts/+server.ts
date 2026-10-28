import { desc, eq } from 'drizzle-orm';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { startExamSchema } from '#lib/exams/session.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const attempts = await getNeonDatabase()
			.select({
				id: examAttempts.id,
				course: examAttempts.course,
				status: examAttempts.status,
				startedAt: examAttempts.startedAt,
				submittedAt: examAttempts.submittedAt,
				score: examAttempts.score
			})
			.from(examAttempts)
			.where(eq(examAttempts.userId, userId))
			.orderBy(desc(examAttempts.startedAt))
			.limit(100);
		return Response.json({ attempts });
	},
	{ logLabel: 'Exam history error', errorMessage: 'Failed to load exam history' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const input = startExamSchema.safeParse(await event.request.json().catch(() => null));
		if (!input.success) return Response.json({ error: 'Invalid exam structure.' }, { status: 400 });
		const [attempt] = await getNeonDatabase()
			.insert(examAttempts)
			.values({
				id: crypto.randomUUID(),
				userId,
				...input.data
			})
			.returning();
		return Response.json({ attempt }, { status: 201 });
	},
	{ logLabel: 'Exam start error', errorMessage: 'Failed to start exam' }
);
