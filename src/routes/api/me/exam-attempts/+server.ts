import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { assembleExamSections } from '#lib/exams/assemble.server.js';
import { resolveRequestPracticeContext } from '#lib/users/practice-context.server.js';
import { createExamAttempt, listExamAttempts } from '#lib/users/exam-attempts.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveRequestPracticeContext(event.locals, userId);
		return Response.json({ attempts: await listExamAttempts(userId, context.organizationId) });
	},
	{ logLabel: 'Exam history error', errorMessage: 'Failed to load exam history' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return Response.json({ error: 'A valid exam start payload is required.' }, { status: 400 });
		}
		const course =
			typeof (body as { course?: unknown }).course === 'string'
				? (body as { course: string }).course.trim()
				: '';
		if (!course) {
			return Response.json({ error: 'course is required.' }, { status: 400 });
		}

		const assembled = await assembleExamSections({ userId, courseName: course });
		if (!assembled.ok) {
			if (assembled.code === 'unsupported') {
				return Response.json({ error: assembled.reason }, { status: 400 });
			}
			if (assembled.code === 'warming') {
				const retryAfterSeconds = assembled.retryAfterSeconds ?? 15;
				return Response.json(
					{ error: assembled.reason, code: 'POOL_WARMING', retryAfterSeconds },
					{ status: 503, headers: { 'Retry-After': String(retryAfterSeconds) } }
				);
			}
			return Response.json({ error: assembled.reason }, { status: 503 });
		}

		const context = await resolveRequestPracticeContext(event.locals, userId);
		const attempt = await createExamAttempt(userId, context, {
			course: assembled.course,
			sections: assembled.sections
		});
		return Response.json({ attempt }, { status: 201 });
	},
	{ logLabel: 'Exam start error', errorMessage: 'Failed to start exam' }
);
