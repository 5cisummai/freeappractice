import { StudyPlanAudit } from '$lib/super/models.server';
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
	_id: unknown;
	action: StudyPlanAuditAction;
	createdAt: Date;
	undoneAt?: Date;
}): StudyPlanAuditView {
	return {
		id: String(audit._id),
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
	const audit = await StudyPlanAudit.create(input);
	return toView(audit);
}

export async function getRecentStudyPlanAudits(userId: string): Promise<StudyPlanAuditView[]> {
	const audits = await StudyPlanAudit.find({ userId })
		.sort({ createdAt: -1, _id: -1 })
		.limit(25)
		.select({ action: 1, createdAt: 1, undoneAt: 1 })
		.lean()
		.exec();
	return audits.map(toView);
}

/** An undo is accepted only when the plan still exactly matches the audited change. */
export async function undoStudyPlanAudit(userId: string, auditId: string): Promise<boolean> {
	if (!auditId.trim()) return false;
	const audit = await StudyPlanAudit.findOne({
		_id: auditId,
		userId,
		undoneAt: { $exists: false }
	}).exec();
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
	audit.undoneAt = new Date();
	await audit.save();
	return true;
}
