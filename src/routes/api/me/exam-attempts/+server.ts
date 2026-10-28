import { desc, eq } from 'drizzle-orm';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
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

// Exam creation is enabled only after trusted blueprint and question assembly exist.
export const POST = withAuthedHandler(
	async () => {
		return Response.json({ error: 'Full-length exams are not available yet.' }, { status: 503 });
	},
	{ logLabel: 'Exam start error', errorMessage: 'Failed to start exam' }
);
