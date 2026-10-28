import { and, eq, sql } from 'drizzle-orm';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { saveExamSchema } from '#lib/exams/session.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';

const notFound = () => Response.json({ error: 'Exam attempt not found.' }, { status: 404 });

export const GET = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return notFound();
		const [attempt] = await getNeonDatabase()
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		return attempt ? Response.json({ attempt }) : notFound();
	},
	{ logLabel: 'Exam lookup error', errorMessage: 'Failed to load exam' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return notFound();
		const input = saveExamSchema.safeParse(await event.request.json().catch(() => null));
		if (!input.success) return Response.json({ error: 'Invalid exam save.' }, { status: 400 });
		const db = getNeonDatabase();
		const [current] = await db
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		if (!current) return notFound();
		const ids = new Set(
			current.sections.flatMap((section) => section.items.map((item) => item.id))
		);
		if (Object.keys(input.data.responses).some((id) => !ids.has(id))) {
			return Response.json({ error: 'Response contains an unknown item.' }, { status: 400 });
		}
		const responses = { ...current.responses, ...input.data.responses };
		if (Object.values(responses).reduce((total, value) => total + value.length, 0) > 500_000) {
			return Response.json({ error: 'Responses are too large.' }, { status: 400 });
		}
		const [attempt] = await db
			.update(examAttempts)
			.set({
				responses,
				status: input.data.submit ? 'submitted' : 'in_progress',
				submittedAt: input.data.submit ? new Date() : null,
				updatedAt: new Date(),
				revision: sql`${examAttempts.revision} + 1`
			})
			.where(
				and(
					eq(examAttempts.id, id),
					eq(examAttempts.userId, userId),
					eq(examAttempts.status, 'in_progress'),
					eq(examAttempts.revision, input.data.revision)
				)
			)
			.returning();
		if (!attempt)
			return Response.json(
				{ error: 'Exam has changed or was submitted. Reload before saving.' },
				{ status: 409 }
			);
		return Response.json({ attempt });
	},
	{ logLabel: 'Exam save error', errorMessage: 'Failed to save exam' }
);
