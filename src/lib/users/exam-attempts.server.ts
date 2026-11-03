import { and, desc, eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';
import {
	assertPracticeContextAccess,
	requirePracticeSession
} from '#lib/users/practice-context.server.js';
import { publishPersonalPracticeActivity } from '#lib/auth/organization-queries.server.js';
const notFound = () => ({ kind: 'not_found' as const });
const conflict = () => ({ kind: 'conflict' as const });
export type ExamMutation = {
	revision: number;
	action: 'start' | 'save' | 'finish';
	responses: Record<string, string>;
};

export async function listExamAttempts(userId: string, organizationId: string | null) {
	await assertPracticeContextAccess(userId, { organizationId });
	return getNeonDatabase()
		.select({
			id: examAttempts.id,
			course: examAttempts.course,
			status: examAttempts.status,
			startedAt: examAttempts.startedAt,
			submittedAt: examAttempts.submittedAt,
			score: examAttempts.score
		})
		.from(examAttempts)
		.where(
			sql`${examAttempts.userId} = ${userId} AND ${examAttempts.organizationId} IS NOT DISTINCT FROM ${organizationId}`
		)
		.orderBy(desc(examAttempts.startedAt))
		.limit(100);
}

export async function getExamAttempt(userId: string, id: string) {
	const [attempt] = await getNeonDatabase()
		.select()
		.from(examAttempts)
		.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
		.limit(1);
	if (attempt)
		await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
	return attempt
		? { kind: 'success' as const, value: { attempt, serverTime: new Date().toISOString() } }
		: notFound();
}

export async function mutateExamAttempt(userId: string, id: string, input: ExamMutation) {
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
	if (current.status !== 'in_progress' || current.revision !== input.revision) return conflict();
	const section = current.sections[current.sectionIndex];
	if (!section) return conflict();
	const { action, responses: changes } = input;
	if (action === 'start' && (current.sectionStartedAt || Object.keys(changes).length))
		return conflict();
	if (action !== 'start' && !current.sectionStartedAt) return conflict();
	const allowed = new Set(section.items.map((item) => item.id));
	if (Object.keys(changes).some((key) => !allowed.has(key)))
		return { kind: 'invalid_item' as const };
	const responses = { ...current.responses, ...changes };
	if (Object.values(responses).reduce((n, value) => n + value.length, 0) > 500000)
		return { kind: 'responses_too_large' as const };
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
			sectionIndex: action === 'finish' && !final ? current.sectionIndex + 1 : current.sectionIndex,
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
				eq(examAttempts.revision, input.revision),
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
			questionsAnswered: 0,
			correctQuestions: 0,
			completedAt: attempt.submittedAt ?? new Date()
		});
	}
	return attempt
		? { kind: 'success' as const, value: { attempt, serverTime: new Date().toISOString() } }
		: conflict();
}
