import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type {
	StudyTask,
	SuperBillingIssue,
	SuperBillingStatus,
	TutorTeachingStyle
} from '$lib/super/types';

export interface ITutorProfile extends Document {
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

const tutorTargetDateSchema = new Schema(
	{
		apClass: { type: String, required: true, trim: true, maxlength: 100 },
		targetDate: { type: Date, required: true }
	},
	{ _id: false }
);

const tutorProfileSchema = new Schema<ITutorProfile>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		ageConfirmedAt: { type: Date },
		mem0UserId: { type: String, required: true, unique: true, index: true },
		selectedApClasses: { type: [String], default: [] },
		targetDates: { type: [tutorTargetDateSchema], default: [] },
		studyAvailability: { type: String, default: '', maxlength: 500 },
		teachingStyle: {
			type: String,
			enum: ['socratic', 'concise', 'step_by_step'],
			default: 'socratic'
		},
		memoryEnabled: { type: Boolean, default: true },
		memoryDisclosureSeenAt: { type: Date },
		superFreeBetaClaimedAt: { type: Date },
		superAccessStartedAt: { type: Date },
		superEndedAt: { type: Date },
		memoryPurgedAt: { type: Date }
	},
	{ timestamps: true }
);

export const TutorProfile: Model<ITutorProfile> =
	(mongoose.models.TutorProfile as Model<ITutorProfile>) ??
	mongoose.model<ITutorProfile>('TutorProfile', tutorProfileSchema, 'tutor_profiles');

export interface ISuperBillingAccess extends Document {
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

const superBillingAccessSchema = new Schema<ISuperBillingAccess>(
	{
		userId: { type: String, required: true, index: true },
		stripeCustomerId: { type: String, index: true, sparse: true },
		stripeSubscriptionId: { type: String, unique: true, sparse: true },
		plan: { type: String, enum: ['super'], required: true },
		status: {
			type: String,
			enum: [
				'active',
				'trialing',
				'past_due',
				'canceled',
				'incomplete',
				'incomplete_expired',
				'unpaid',
				'paused'
			],
			required: true
		},
		periodStart: { type: Date },
		periodEnd: { type: Date },
		cancelAtPeriodEnd: { type: Boolean, default: false },
		cancelAt: { type: Date },
		pastDueSince: { type: Date },
		superEndedAt: { type: Date },
		billingIssue: {
			type: String,
			enum: ['payment_failed', 'payment_action_required', 'invoice_finalization_failed']
		},
		billingIssueAt: { type: Date },
		lastStripeEventId: { type: String },
		lastStripeEventCreated: { type: Date },
		lastBillingEventCreated: { type: Date }
	},
	{ timestamps: true }
);
superBillingAccessSchema.index({ userId: 1, status: 1 });

export const SuperBillingAccess: Model<ISuperBillingAccess> =
	(mongoose.models.SuperBillingAccess as Model<ISuperBillingAccess>) ??
	mongoose.model<ISuperBillingAccess>(
		'SuperBillingAccess',
		superBillingAccessSchema,
		'super_billing_access'
	);

export interface ISuperGrant extends Document {
	userId: string;
	startsAt: Date;
	expiresAt: Date;
	reason: string;
	createdBy: string;
	revokedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const superGrantSchema = new Schema<ISuperGrant>(
	{
		userId: { type: String, required: true, index: true },
		startsAt: { type: Date, required: true },
		expiresAt: { type: Date, required: true, index: true },
		reason: { type: String, required: true, maxlength: 500 },
		createdBy: { type: String, required: true },
		revokedAt: { type: Date }
	},
	{ timestamps: true }
);
superGrantSchema.index({ userId: 1, startsAt: 1, expiresAt: 1 });

export const SuperGrant: Model<ISuperGrant> =
	(mongoose.models.SuperGrant as Model<ISuperGrant>) ??
	mongoose.model<ISuperGrant>('SuperGrant', superGrantSchema, 'super_grants');

export interface ISuperUsageRollup extends Document {
	userId: string;
	month: string;
	personalizedMessages: number;
	updatedAt: Date;
}

const superUsageRollupSchema = new Schema<ISuperUsageRollup>(
	{
		userId: { type: String, required: true },
		month: { type: String, required: true },
		personalizedMessages: { type: Number, required: true, min: 0 }
	},
	{ timestamps: true }
);
superUsageRollupSchema.index({ userId: 1, month: 1 }, { unique: true });

export const SuperUsageRollup: Model<ISuperUsageRollup> =
	(mongoose.models.SuperUsageRollup as Model<ISuperUsageRollup>) ??
	mongoose.model<ISuperUsageRollup>(
		'SuperUsageRollup',
		superUsageRollupSchema,
		'super_usage_rollups'
	);

export interface IInsightReport extends Document {
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

const insightReportSchema = new Schema<IInsightReport>(
	{
		userId: { type: String, required: true, index: true },
		report: { type: Schema.Types.Mixed, required: true },
		evidenceAttemptCount: { type: Number, required: true, min: 0 },
		generatedAt: { type: Date, required: true, index: true },
		manual: { type: Boolean, required: true },
		pdfData: { type: Buffer },
		pdfGeneratedAt: { type: Date },
		pdfGenerationVersion: { type: Number, min: 1 },
		feedback: { type: String, enum: ['helpful', 'not_helpful'] },
		feedbackReason: { type: String, maxlength: 120 },
		lockedAt: { type: Date }
	},
	{ timestamps: true }
);
insightReportSchema.index({ userId: 1, generatedAt: -1 });

export const InsightReport: Model<IInsightReport> =
	(mongoose.models.InsightReport as Model<IInsightReport>) ??
	mongoose.model<IInsightReport>('InsightReport', insightReportSchema, 'insight_reports');

export interface IStudyPlan extends Document {
	userId: string;
	startsOn: Date;
	tasks: StudyTask[];
	createdAt: Date;
	updatedAt: Date;
}

const studyTaskSchema = new Schema(
	{
		id: { type: String, required: true },
		apClass: { type: String, required: true, maxlength: 100 },
		unit: { type: String, required: true, maxlength: 200 },
		mode: { type: String, enum: ['mcq', 'frq', 'review'], required: true },
		date: { type: Date, required: true },
		durationMinutes: { type: Number, required: true, min: 5, max: 480 },
		status: { type: String, enum: ['todo', 'done'], required: true, default: 'todo' },
		practiceHref: { type: String, maxlength: 500 }
	},
	{ _id: false }
);

const studyPlanSchema = new Schema<IStudyPlan>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		startsOn: { type: Date, required: true },
		tasks: { type: [studyTaskSchema], default: [] }
	},
	{ timestamps: true }
);

export const StudyPlan: Model<IStudyPlan> =
	(mongoose.models.StudyPlan as Model<IStudyPlan>) ??
	mongoose.model<IStudyPlan>('StudyPlan', studyPlanSchema, 'study_plans');

export interface IStudyPlanAudit extends Document {
	userId: string;
	action: 'generate' | 'complete' | 'reschedule';
	before: Record<string, unknown> | null;
	after: Record<string, unknown>;
	undoneAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const studyPlanAuditSchema = new Schema<IStudyPlanAudit>(
	{
		userId: { type: String, required: true, index: true },
		action: { type: String, enum: ['generate', 'complete', 'reschedule'], required: true },
		before: { type: Schema.Types.Mixed, default: null },
		after: { type: Schema.Types.Mixed, required: true },
		undoneAt: { type: Date }
	},
	{ timestamps: true }
);
studyPlanAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const StudyPlanAudit: Model<IStudyPlanAudit> =
	(mongoose.models.StudyPlanAudit as Model<IStudyPlanAudit>) ??
	mongoose.model<IStudyPlanAudit>('StudyPlanAudit', studyPlanAuditSchema, 'study_plan_audits');

export interface ICoachAudit extends Document {
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

const coachAuditSchema = new Schema<ICoachAudit>(
	{
		userId: { type: String, required: true, index: true },
		sessionId: { type: String, required: true, index: true },
		toolName: { type: String, required: true },
		before: { type: Schema.Types.Mixed, required: true },
		after: { type: Schema.Types.Mixed, required: true },
		modelId: { type: String, required: true },
		undoneAt: { type: Date }
	},
	{ timestamps: true }
);
coachAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const CoachAudit: Model<ICoachAudit> =
	(mongoose.models.CoachAudit as Model<ICoachAudit>) ??
	mongoose.model<ICoachAudit>('CoachAudit', coachAuditSchema, 'coach_audits');

export interface ISuperCleanupJob extends Document {
	userId: string;
	mem0UserId: string;
	kind: 'account_delete' | 'downgrade_purge';
	nextAttemptAt: Date;
	attempts: number;
	lastError?: string;
	completedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const superCleanupJobSchema = new Schema<ISuperCleanupJob>(
	{
		userId: { type: String, required: true, index: true },
		mem0UserId: { type: String, required: true },
		kind: { type: String, enum: ['account_delete', 'downgrade_purge'], required: true },
		nextAttemptAt: { type: Date, required: true, index: true },
		attempts: { type: Number, default: 0, min: 0 },
		lastError: { type: String, maxlength: 500 },
		completedAt: { type: Date }
	},
	{ timestamps: true }
);
superCleanupJobSchema.index({ userId: 1, kind: 1, completedAt: 1 });
// A completed job is only retained briefly for operational inspection. Pending jobs have no TTL.
superCleanupJobSchema.index({ completedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const SuperCleanupJob: Model<ISuperCleanupJob> =
	(mongoose.models.SuperCleanupJob as Model<ISuperCleanupJob>) ??
	mongoose.model<ISuperCleanupJob>('SuperCleanupJob', superCleanupJobSchema, 'super_cleanup_jobs');
