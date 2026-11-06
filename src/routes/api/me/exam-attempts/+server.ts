import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { resolveRequestPracticeContext } from '#lib/users/practice-context.server.js';
import { listExamAttempts } from '#lib/users/exam-attempts.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveRequestPracticeContext(event.locals, userId);
		return Response.json({ attempts: await listExamAttempts(userId, context.organizationId) });
	},
	{ logLabel: 'Exam history error', errorMessage: 'Failed to load exam history' }
);

// Exam creation is enabled only after trusted blueprint and question assembly exist.
export const POST = withAuthedHandler(
	async () => Response.json({ error: 'Full-length exams are not available yet.' }, { status: 503 }),
	{ logLabel: 'Exam start error', errorMessage: 'Failed to start exam' }
);
