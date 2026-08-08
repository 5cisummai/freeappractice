import { randomUUID } from 'node:crypto';
import type {
	StudyTask,
	SuperBillingIssue,
	SuperBillingStatus,
	TutorTeachingStyle
} from '$lib/super/types';
import {
	coachAudits,
	insightReports,
	studyPlanAudits,
	studyPlans,
	superBillingAccess,
	superCleanupJobs,
	superGrants,
	superUsageRollups,
	tutorProfiles
} from '$lib/server/neon/schema';
import { model, type PostgresModel } from '$lib/server/neon/model';

type DocumentFields = { _id: string; save: () => Promise<unknown> };

export interface ITutorProfile extends DocumentFields {
	userId: string;
	ageConfirmedAt?: Date;
	mem0UserId: string;
	selectedApClasses: string[];
	targetDates: Array<{ apClass: string; targetDate: Date }>;
	studyAvailability: string;
	teachingStyle: TutorTeachingStyle;
	memoryEnabled: boolean;
	memoryDisclosureSeenAt?: Date;
	superFreeBetaClaimedAt?: Date;
	superAccessStartedAt?: Date;
	superEndedAt?: Date;
	memoryPurgedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ISuperBillingAccess extends DocumentFields {
	userId: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	plan: 'super';
	status: SuperBillingStatus;
	periodStart?: Date;
	periodEnd?: Date;
	cancelAtPeriodEnd: boolean;
	cancelAt?: Date;
	pastDueSince?: Date;
	superEndedAt?: Date;
	billingIssue?: SuperBillingIssue;
	billingIssueAt?: Date;
	lastStripeEventId?: string;
	lastStripeEventCreated?: Date;
	lastBillingEventCreated?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ISuperGrant extends DocumentFields {
	userId: string;
	startsAt: Date;
	expiresAt: Date;
	reason: string;
	createdBy: string;
	revokedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ISuperUsageRollup extends DocumentFields {
	userId: string;
	month: string;
	personalizedMessages: number;
	updatedAt: Date;
}

export interface IInsightReport extends DocumentFields {
	userId: string;
	report: Record<string, unknown>;
	evidenceAttemptCount: number;
	generatedAt: Date;
	manual: boolean;
	pdfData?: Buffer;
	pdfGeneratedAt?: Date;
	pdfGenerationVersion?: number;
	feedback?: 'helpful' | 'not_helpful';
	feedbackReason?: string;
	lockedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface IStudyPlan extends DocumentFields {
	userId: string;
	startsOn: Date;
	tasks: StudyTask[];
	createdAt: Date;
	updatedAt: Date;
}

export interface IStudyPlanAudit extends DocumentFields {
	userId: string;
	action: 'generate' | 'complete' | 'reschedule';
	before: Record<string, unknown> | null;
	after: Record<string, unknown>;
	undoneAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICoachAudit extends DocumentFields {
	userId: string;
	sessionId: string;
	toolName: string;
	before: Record<string, unknown>;
	after: Record<string, unknown>;
	modelId: string;
	undoneAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ISuperCleanupJob extends DocumentFields {
	userId: string;
	mem0UserId: string;
	kind: 'account_delete' | 'downgrade_purge';
	nextAttemptAt: Date;
	attempts: number;
	lastError?: string;
	completedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	deleteOne: () => Promise<unknown>;
}

function withId(input: Record<string, unknown>): Record<string, unknown> {
	return { id: input.id ?? randomUUID(), ...input };
}

export const TutorProfile: PostgresModel<ITutorProfile> = model<ITutorProfile>({
	table: tutorProfiles as any,
	columns: tutorProfiles as any,
	idField: 'userId',
	fromRow: (row) => ({
		...(row as unknown as ITutorProfile),
		selectedApClasses: [],
		targetDates: []
	}),
	prepareInsert: async (input) => withId(input)
});

export const SuperBillingAccess: PostgresModel<ISuperBillingAccess> = model<ISuperBillingAccess>({
	table: superBillingAccess as any,
	columns: superBillingAccess as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});

export const SuperGrant: PostgresModel<ISuperGrant> = model<ISuperGrant>({
	table: superGrants as any,
	columns: superGrants as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});

export const SuperUsageRollup: PostgresModel<ISuperUsageRollup> = model<ISuperUsageRollup>({
	table: superUsageRollups as any,
	columns: superUsageRollups as any,
	idField: 'userId'
});

export const InsightReport: PostgresModel<IInsightReport> = model<IInsightReport>({
	table: insightReports as any,
	columns: insightReports as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});

export const StudyPlan: PostgresModel<IStudyPlan> = model<IStudyPlan>({
	table: studyPlans as any,
	columns: studyPlans as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input),
	fromRow: (row) => ({ ...(row as unknown as IStudyPlan), tasks: [] })
});

export const StudyPlanAudit: PostgresModel<IStudyPlanAudit> = model<IStudyPlanAudit>({
	table: studyPlanAudits as any,
	columns: studyPlanAudits as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});

export const CoachAudit: PostgresModel<ICoachAudit> = model<ICoachAudit>({
	table: coachAudits as any,
	columns: coachAudits as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});

export const SuperCleanupJob: PostgresModel<ISuperCleanupJob> = model<ISuperCleanupJob>({
	table: superCleanupJobs as any,
	columns: superCleanupJobs as any,
	idField: 'id',
	prepareInsert: async (input) => withId(input)
});
