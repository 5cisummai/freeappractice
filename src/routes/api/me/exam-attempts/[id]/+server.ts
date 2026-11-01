import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';
import {
	assertPracticeContextAccess,
	requirePracticeSession
} from '#lib/users/practice-context.server.js';
import { publishPersonalPracticeActivity } from '#lib/auth/organization-queries.server.js';

const notFound = () => Response.json({ error: 'Exam attempt not found.' }, { status: 404 });
const conflict = () =>
	Response.json(
		{ error: 'Exam changed or the section is closed. Reload and try again.' },
		{ status: 409 }
	);
const mutation = z
	.object({
		revision: z.number().int().nonnegative(),
		action: z.enum(['start', 'save', 'finish']),
		responses: z.record(z.string().min(1).max(128), z.string().max(50000)).default({})
	})
	.strict();

export const GET = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return notFound();
		const [attempt] = await getNeonDatabase()
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		if (attempt)
			await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
		return attempt ? Response.json({ attempt, serverTime: new Date().toISOString() }) : notFound();
	},
	{ logLabel: 'Exam lookup error', errorMessage: 'Failed to load exam' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return notFound();
		const input = mutation.safeParse(await event.request.json().catch(() => null));
		if (!input.success) return Response.json({ error: 'Invalid exam save.' }, { status: 400 });
		const db = getNeonDatabase();
		const [current] = await db
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		if (!current) return notFound();
		if (current.practiceSessionId)
			await requirePracticeSession(userId, current.practiceSessionId, 'exam');
		else await assertPracticeContextAccess(userId, { organizationId: current.organizationId });
		if (current.status !== 'in_progress' || current.revision !== input.data.revision)
			return conflict();
		const section = current.sections[current.sectionIndex];
		if (!section) return conflict();
		const { action, responses: changes } = input.data;
		if (action === 'start' && (current.sectionStartedAt || Object.keys(changes).length))
			return conflict();
		if (action !== 'start' && !current.sectionStartedAt) return conflict();
		const allowed = new Set(section.items.map((item) => item.id));
		if (Object.keys(changes).some((key) => !allowed.has(key)))
			return Response.json(
				{ error: 'Response contains an item outside the active section.' },
				{ status: 400 }
			);
		const responses = { ...current.responses, ...changes };
		if (Object.values(responses).reduce((n, value) => n + value.length, 0) > 500000)
			return Response.json({ error: 'Responses are too large.' }, { status: 400 });
		const now = new Date();
		const deadline =
			current.sectionStartedAt && section.timeLimitMs !== null
				? new Date(current.sectionStartedAt.getTime() + section.timeLimitMs)
				: null;
		// Late requests can close an expired section, but cannot add late answers.
		const expired = deadline !== null && now >= deadline;
		if (expired && Object.keys(changes).length) return conflict();
		if (action === 'save' && expired) return conflict();
		const final = action === 'finish' && current.sectionIndex === current.sections.length - 1;
		const completed = [...current.sectionCompletedAt];
		if (action === 'finish')
			completed[current.sectionIndex] = (expired && deadline ? deadline : now).toISOString();
		const [attempt] = await db
			.update(examAttempts)
			.set({
				responses,
				sectionIndex:
					action === 'finish' && !final ? current.sectionIndex + 1 : current.sectionIndex,
				sectionStartedAt:
					action === 'start' ? now : action === 'finish' ? null : current.sectionStartedAt,
				sectionCompletedAt: completed,
				status: final ? 'submitted' : 'in_progress',
				submittedAt: final ? now : null,
				updatedAt: now,
				revision: sql`${examAttempts.revision} + 1`
			})
			.where(
				and(
					eq(examAttempts.id, id),
					eq(examAttempts.userId, userId),
					eq(examAttempts.status, 'in_progress'),
					eq(examAttempts.revision, input.data.revision),
					// Enforce the deadline at the database too, including time spent in transit.
					...(deadline && Object.keys(changes).length ? [sql`now() < ${deadline}`] : [])
				)
			)
			.returning();
		if (attempt && final && !attempt.organizationId) {
			await publishPersonalPracticeActivity({
				userId,
				sourceType: 'exam',
				sourceId: attempt.id,
				course: attempt.course,
				unit: 'Exam',
				scorePercent: null,
				questionsAnswered: Object.keys(attempt.responses).length,
				correctQuestions: 0,
				completedAt: attempt.submittedAt ?? new Date()
			});
		}
		return attempt ? Response.json({ attempt, serverTime: new Date().toISOString() }) : conflict();
	},
	{ logLabel: 'Exam save error', errorMessage: 'Failed to save exam' }
);
