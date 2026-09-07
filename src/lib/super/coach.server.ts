import { and, desc, eq, isNull } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { coachAudits } from '$lib/server/neon/schema';
import { getTutorProfileView, updateTutorProfile } from '$lib/super/profile.server';
import { deleteStudyPlan, getCurrentStudyPlan, saveStudyPlan } from '$lib/super/study-plan.server';
import type { StudyPlanView, TutorProfileView } from '$lib/super/types';

export type { SuperAgentContext, SuperAgentMode } from '$lib/super/coach-agent.types';
export { createSuperTools } from '$lib/super/coach-tools.server';
export type { SuperToolsInput } from '$lib/super/coach-agent.types';
export { createCoachAgent, createSuperAgent } from '$lib/super/agent.server';
export type { CoachUIMessage, SuperAgentUIMessage } from '$lib/super/agent.server';

export type CoachAuditView = {
	id: string;
	toolName: 'update_goals' | 'update_study_plan';
	createdAt: string;
	undoneAt: string | null;
};

export async function getRecentCoachAudits(userId: string): Promise<CoachAuditView[]> {
	const audits = await getNeonDatabase()
		.select({
			id: coachAudits.id,
			toolName: coachAudits.toolName,
			createdAt: coachAudits.createdAt,
			undoneAt: coachAudits.undoneAt
		})
		.from(coachAudits)
		.where(eq(coachAudits.userId, userId))
		.orderBy(desc(coachAudits.createdAt), desc(coachAudits.id))
		.limit(25);
	return audits.flatMap((audit) => {
		if (audit.toolName !== 'update_goals' && audit.toolName !== 'update_study_plan') return [];
		return [
			{
				id: audit.id,
				toolName: audit.toolName,
				createdAt: audit.createdAt.toISOString(),
				undoneAt: audit.undoneAt?.toISOString() ?? null
			}
		];
	});
}

function goalSnapshot(
	profile: TutorProfileView
): Pick<TutorProfileView, 'selectedApClasses' | 'targetDates' | 'studyAvailability'> {
	return {
		selectedApClasses: profile.selectedApClasses,
		targetDates: profile.targetDates,
		studyAvailability: profile.studyAvailability
	};
}

function hasSameValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export async function undoCoachAudit(userId: string, auditId: string): Promise<boolean> {
	const db = getNeonDatabase();
	const [audit] = await db
		.select()
		.from(coachAudits)
		.where(
			and(eq(coachAudits.id, auditId), eq(coachAudits.userId, userId), isNull(coachAudits.undoneAt))
		)
		.limit(1);
	if (!audit) return false;
	if (audit.toolName === 'update_goals') {
		const current = await getTutorProfileView(userId);
		if (!hasSameValue(goalSnapshot(current), goalSnapshot(audit.after as TutorProfileView)))
			return false;
		await updateTutorProfile(userId, goalSnapshot(audit.before as TutorProfileView));
	} else if (audit.toolName === 'update_study_plan') {
		const before = audit.before as Partial<StudyPlanView>;
		const after = audit.after as StudyPlanView;
		const current = await getCurrentStudyPlan(userId);
		if (!hasSameValue(current, after)) return false;
		if (!before.startsOn || !before.tasks) await deleteStudyPlan(userId);
		else {
			await saveStudyPlan(
				userId,
				{ startsOn: before.startsOn, tasks: before.tasks },
				{ behavior: 'replace' }
			);
		}
	} else {
		return false;
	}
	const updated = await db
		.update(coachAudits)
		.set({ undoneAt: new Date(), updatedAt: new Date() })
		.where(
			and(eq(coachAudits.id, auditId), eq(coachAudits.userId, userId), isNull(coachAudits.undoneAt))
		)
		.returning({ id: coachAudits.id });
	return updated.length === 1;
}
