import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { studyPlanAudits } from '$lib/server/neon/schema';
import { deleteStudyPlan, getCurrentStudyPlan, saveStudyPlan } from '$lib/super/study-plan.server';
import type { StudyPlanView } from '$lib/super/types';

export type StudyPlanAuditAction = 'generate' | 'complete' | 'reschedule';

export type StudyPlanAuditView = {
	id: string;
	action: StudyPlanAuditAction;
	createdAt: string;
	undoneAt: string | null;
};

function sameValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function toView(audit: {
	id: string;
	action: StudyPlanAuditAction;
	createdAt: Date;
	undoneAt?: Date | null;
}): StudyPlanAuditView {
	return {
		id: audit.id,
		action: audit.action,
		createdAt: audit.createdAt.toISOString(),
		undoneAt: audit.undoneAt?.toISOString() ?? null
	};
}

export async function writeStudyPlanAudit(input: {
	userId: string;
	action: StudyPlanAuditAction;
	before: StudyPlanView | null;
	after: StudyPlanView;
}): Promise<StudyPlanAuditView> {
	const [audit] = await getNeonDatabase()
		.insert(studyPlanAudits)
		.values({ id: randomUUID(), ...input })
		.returning({
			id: studyPlanAudits.id,
			action: studyPlanAudits.action,
			createdAt: studyPlanAudits.createdAt,
			undoneAt: studyPlanAudits.undoneAt
		});
	if (!audit) throw new Error('Study plan audit insert returned no row');
	return toView({ ...audit, action: audit.action as StudyPlanAuditAction });
}

export async function getRecentStudyPlanAudits(userId: string): Promise<StudyPlanAuditView[]> {
	const audits = await getNeonDatabase()
		.select({
			id: studyPlanAudits.id,
			action: studyPlanAudits.action,
			createdAt: studyPlanAudits.createdAt,
			undoneAt: studyPlanAudits.undoneAt
		})
		.from(studyPlanAudits)
		.where(eq(studyPlanAudits.userId, userId))
		.orderBy(desc(studyPlanAudits.createdAt), desc(studyPlanAudits.id))
		.limit(25);
	return audits
		.map((audit) => ({ ...audit, action: audit.action as StudyPlanAuditAction }))
		.map(toView);
}

/** An undo is accepted only when the plan still exactly matches the audited change. */
export async function undoStudyPlanAudit(userId: string, auditId: string): Promise<boolean> {
	if (!auditId.trim()) return false;
	const db = getNeonDatabase();
	const [audit] = await db
		.select()
		.from(studyPlanAudits)
		.where(
			and(
				eq(studyPlanAudits.id, auditId),
				eq(studyPlanAudits.userId, userId),
				isNull(studyPlanAudits.undoneAt)
			)
		)
		.limit(1);
	if (!audit) return false;

	const current = await getCurrentStudyPlan(userId);
	if (!sameValue(current, audit.after)) return false;
	const before = audit.before as StudyPlanView | null;
	if (before?.startsOn && before.tasks) {
		await saveStudyPlan(
			userId,
			{ startsOn: before.startsOn, tasks: before.tasks },
			{ behavior: 'replace' }
		);
	} else {
		await deleteStudyPlan(userId);
	}
	const updated = await db
		.update(studyPlanAudits)
		.set({ undoneAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(studyPlanAudits.id, auditId),
				eq(studyPlanAudits.userId, userId),
				isNull(studyPlanAudits.undoneAt)
			)
		)
		.returning({ id: studyPlanAudits.id });
	return updated.length === 1;
}
