import {
	bigint,
	boolean,
	check,
	customType,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgSchema,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => 'bytea'
});

export const authSchema = pgSchema('auth');
export const appSchema = pgSchema('app');
export const contentSchema = pgSchema('content');
export const opsSchema = pgSchema('ops');

// Better Auth tables. The logical keys below intentionally match the current
// modelName values in src/lib/auth/server.ts so the migration preserves auth
// behavior and tokens without an adapter-side rename.
export const authUsers = authSchema.table(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		stripeCustomerId: text('stripe_customer_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('auth_users_email_uq').on(table.email)]
);

export const authSessions = authSchema.table(
	'sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		token: text('token').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('auth_sessions_token_uq').on(table.token),
		index('auth_sessions_user_id_idx').on(table.userId),
		index('auth_sessions_expires_at_idx').on(table.expiresAt)
	]
);

export const authAccounts = authSchema.table(
	'accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
			withTimezone: true,
			mode: 'date'
		}),
		scope: text('scope'),
		password: text('password'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('auth_accounts_user_id_idx').on(table.userId),
		uniqueIndex('auth_accounts_provider_account_uq').on(table.providerId, table.accountId)
	]
);

export const authVerifications = authSchema.table(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('auth_verifications_identifier_idx').on(table.identifier)]
);

export const authSubscriptions = authSchema.table(
	'subscriptions',
	{
		id: text('id').primaryKey(),
		plan: text('plan').notNull(),
		referenceId: text('reference_id').notNull(),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		status: text('status').notNull().default('incomplete'),
		periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }),
		periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
		trialStart: timestamp('trial_start', { withTimezone: true, mode: 'date' }),
		trialEnd: timestamp('trial_end', { withTimezone: true, mode: 'date' }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
		cancelAt: timestamp('cancel_at', { withTimezone: true, mode: 'date' }),
		canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
		endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
		seats: integer('seats'),
		billingInterval: text('billing_interval'),
		stripeScheduleId: text('stripe_schedule_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('auth_subscriptions_reference_id_idx').on(table.referenceId),
		uniqueIndex('auth_subscriptions_stripe_subscription_uq').on(table.stripeSubscriptionId),
		index('auth_subscriptions_stripe_customer_idx').on(table.stripeCustomerId)
	]
);

export const authRateLimits = authSchema.table(
	'rate_limits',
	{
		id: text('id').primaryKey(),
		key: text('key').notNull(),
		count: integer('count').notNull(),
		lastRequest: bigint('last_request', { mode: 'number' }).notNull()
	},
	(table) => [uniqueIndex('auth_rate_limits_key_uq').on(table.key)]
);

// User-owned application data. Arrays and JSONB are limited to values that
// are genuinely document-shaped; facts that are queried or joined are rows.
export const userProfiles = appSchema.table(
	'user_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		referralCode: text('referral_code'),
		subjects: text('subjects').array().notNull().default(sql`ARRAY[]::text[]`),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('user_profiles_referral_code_uq').on(table.referralCode)]
);

export const userSubjects = appSchema.table(
	'user_subjects',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		subject: text('subject').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: createdAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.subject] })]
);

export const mcqAttempts = appSchema.table(
	'mcq_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		questionId: text('question_id').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		selectedAnswer: text('selected_answer'),
		wasCorrect: boolean('was_correct'),
		timeTakenMs: integer('time_taken_ms'),
		attemptedAt: timestamp('attempted_at', { withTimezone: true, mode: 'date' }).notNull(),
		finalAnswer: text('final_answer'),
		answerCount: integer('answer_count'),
		hintsShown: integer('hints_shown'),
		terminalOutcome: text('terminal_outcome'),
		experimentKey: text('experiment_key'),
		experimentVersion: integer('experiment_version'),
		displayedVariant: text('displayed_variant'),
		createdAt: createdAt()
	},
	(table) => [
		index('mcq_attempts_user_attempted_idx').on(table.userId, table.attemptedAt),
		index('mcq_attempts_question_idx').on(table.questionId),
		index('mcq_attempts_user_class_unit_idx').on(table.userId, table.apClass, table.unit)
	]
);

export const userProgress = appSchema.table(
	'user_progress',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		completed: boolean('completed').notNull().default(false),
		mastery: real('mastery').notNull().default(0),
		totalAttempts: integer('total_attempts').notNull().default(0),
		correctAttempts: integer('correct_attempts').notNull().default(0),
		lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),
		lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true, mode: 'date' }),
		updatedAt: updatedAt()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.apClass, table.unit] }),
		check('user_progress_mastery_range', sql`${table.mastery} >= 0 AND ${table.mastery} <= 100`)
	]
);

export const bookmarks = appSchema.table(
	'bookmarks',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		questionId: text('question_id').notNull(),
		createdAt: createdAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.questionId] })]
);

export const experimentAssignments = appSchema.table(
	'experiment_assignments',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		version: integer('version').notNull(),
		variant: text('variant').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.key] })]
);

export const referrals = appSchema.table(
	'referrals',
	{
		id: text('id').primaryKey(),
		referrerUserId: text('referrer_user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		referredUserId: text('referred_user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		activatedAt: timestamp('activated_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('referrals_referred_user_uq').on(table.referredUserId),
		index('referrals_referrer_activated_idx').on(table.referrerUserId, table.activatedAt)
	]
);

export const frqAttempts = appSchema.table(
	'frq_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		submissionId: text('submission_id').notNull(),
		questionId: text('question_id').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		formatId: text('format_id').notNull(),
		responses: jsonb('responses').$type<Record<string, string>>().notNull(),
		status: text('status').notNull(),
		timeTakenMs: integer('time_taken_ms').notNull(),
		profileVersion: text('profile_version').notNull(),
		rubricVersion: text('rubric_version').notNull(),
		promptVersion: text('prompt_version').notNull(),
		gradingModel: text('grading_model'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('frq_attempts_user_submission_uq').on(table.userId, table.submissionId),
		index('frq_attempts_user_created_idx').on(table.userId, table.createdAt),
		index('frq_attempts_user_class_unit_idx').on(table.userId, table.apClass, table.unit)
	]
);

export const frqAttemptGrades = appSchema.table('frq_attempt_grades', {
	attemptId: text('attempt_id')
		.primaryKey()
		.references(() => frqAttempts.id, { onDelete: 'cascade' }),
	pointsEarned: real('points_earned').notNull(),
	pointsAvailable: real('points_available').notNull(),
	percentage: real('percentage').notNull(),
	overallFeedback: text('overall_feedback').notNull()
});

export const frqAttemptCriterionGrades = appSchema.table(
	'frq_attempt_criterion_grades',
	{
		attemptId: text('attempt_id')
			.notNull()
			.references(() => frqAttempts.id, { onDelete: 'cascade' }),
		criterionId: text('criterion_id').notNull(),
		sectionId: text('section_id').notNull(),
		label: text('label').notNull(),
		points: real('points').notNull(),
		pointsAvailable: real('points_available').notNull(),
		evidence: text('evidence').notNull().default(''),
		feedback: text('feedback').notNull()
	},
	(table) => [primaryKey({ columns: [table.attemptId, table.criterionId] })]
);

export const tutorProfiles = appSchema.table(
	'tutor_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true, mode: 'date' }),
		mem0UserId: text('mem0_user_id').notNull(),
		studyAvailability: text('study_availability').notNull().default(''),
		teachingStyle: text('teaching_style').notNull().default('socratic'),
		memoryEnabled: boolean('memory_enabled').notNull().default(true),
		memoryDisclosureSeenAt: timestamp('memory_disclosure_seen_at', { withTimezone: true, mode: 'date' }),
		superFreeBetaClaimedAt: timestamp('super_free_beta_claimed_at', { withTimezone: true, mode: 'date' }),
		superAccessStartedAt: timestamp('super_access_started_at', { withTimezone: true, mode: 'date' }),
		superEndedAt: timestamp('super_ended_at', { withTimezone: true, mode: 'date' }),
		memoryPurgedAt: timestamp('memory_purged_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('tutor_profiles_mem0_user_uq').on(table.mem0UserId)]
);

export const tutorProfileClasses = appSchema.table(
	'tutor_profile_classes',
	{
		userId: text('user_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.userId, table.apClass] })]
);

export const tutorTargetDates = appSchema.table(
	'tutor_target_dates',
	{
		userId: text('user_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		targetDate: date('target_date', { mode: 'date' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.apClass] })]
);

export const superBillingAccess = appSchema.table(
	'super_billing_access',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		plan: text('plan').notNull(),
		status: text('status').notNull(),
		periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }),
		periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
		cancelAt: timestamp('cancel_at', { withTimezone: true, mode: 'date' }),
		pastDueSince: timestamp('past_due_since', { withTimezone: true, mode: 'date' }),
		superEndedAt: timestamp('super_ended_at', { withTimezone: true, mode: 'date' }),
		billingIssue: text('billing_issue'),
		billingIssueAt: timestamp('billing_issue_at', { withTimezone: true, mode: 'date' }),
		lastStripeEventId: text('last_stripe_event_id'),
		lastStripeEventCreated: timestamp('last_stripe_event_created', { withTimezone: true, mode: 'date' }),
		lastBillingEventCreated: timestamp('last_billing_event_created', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('super_billing_access_subscription_uq').on(table.stripeSubscriptionId),
		index('super_billing_access_user_idx').on(table.userId),
		index('super_billing_access_status_idx').on(table.status)
	]
);

export const superGrants = appSchema.table(
	'super_grants',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		reason: text('reason').notNull(),
		createdBy: text('created_by').notNull(),
		revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('super_grants_user_expiry_idx').on(table.userId, table.startsAt, table.expiresAt)]
);

export const superUsageRollups = appSchema.table(
	'super_usage_rollups',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		month: text('month').notNull(),
		personalizedMessages: integer('personalized_messages').notNull().default(0),
		updatedAt: updatedAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.month] })]
);

export const insightReports = appSchema.table(
	'insight_reports',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		report: jsonb('report').$type<Record<string, unknown>>().notNull(),
		evidenceAttemptCount: integer('evidence_attempt_count').notNull(),
		generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' }).notNull(),
		manual: boolean('manual').notNull(),
		pdfData: bytea('pdf_data'),
		pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true, mode: 'date' }),
		pdfGenerationVersion: integer('pdf_generation_version'),
		feedback: text('feedback'),
		feedbackReason: text('feedback_reason'),
		lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('insight_reports_user_generated_idx').on(table.userId, table.generatedAt)]
);

export const studyPlans = appSchema.table(
	'study_plans',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		startsOn: date('starts_on', { mode: 'date' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('study_plans_user_uq').on(table.userId)]
);

export const studyTasks = appSchema.table(
	'study_tasks',
	{
		id: text('id').primaryKey(),
		planId: text('plan_id')
			.notNull()
			.references(() => studyPlans.id, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		mode: text('mode').notNull(),
		taskDate: date('task_date', { mode: 'date' }).notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		status: text('status').notNull().default('todo'),
		practiceHref: text('practice_href')
	},
	(table) => [index('study_tasks_plan_date_idx').on(table.planId, table.taskDate)]
);

export const studyPlanAudits = appSchema.table(
	'study_plan_audits',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		action: text('action').notNull(),
		before: jsonb('before').$type<Record<string, unknown> | null>(),
		after: jsonb('after').$type<Record<string, unknown>>().notNull(),
		undoneAt: timestamp('undone_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('study_plan_audits_user_created_idx').on(table.userId, table.createdAt)]
);

export const coachAudits = appSchema.table(
	'coach_audits',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		sessionId: text('session_id').notNull(),
		toolName: text('tool_name').notNull(),
		before: jsonb('before').$type<Record<string, unknown>>().notNull(),
		after: jsonb('after').$type<Record<string, unknown>>().notNull(),
		modelId: text('model_id').notNull(),
		undoneAt: timestamp('undone_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('coach_audits_user_session_idx').on(table.userId, table.sessionId)]
);

export const conversations = appSchema.table(
	'conversations',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('conversations_user_updated_idx').on(table.userId, table.updatedAt)]
);

export const conversationMessages = appSchema.table(
	'conversation_messages',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		role: text('role').notNull(),
		content: text('content').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
	},
	(table) => [
		uniqueIndex('conversation_messages_conversation_position_uq').on(table.conversationId, table.position),
		index('conversation_messages_conversation_created_idx').on(table.conversationId, table.createdAt)
	]
);

export const seenQuestions = appSchema.table(
	'seen_questions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		contentHash: text('content_hash').notNull(),
		questionType: text('question_type').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }).notNull()
	},
	(table) => [
		index('seen_questions_user_seen_idx').on(table.userId, table.seenAt),
		index('seen_questions_user_hash_idx').on(table.userId, table.contentHash)
	]
);

// Canonical content registry and serving library.
export const questionRegistry = contentSchema.table(
	'question_registry',
	{
		questionId: text('question_id').primaryKey(),
		kind: text('kind').notNull(),
		apClass: text('ap_class'),
		unit: text('unit'),
		questionCreatedAt: timestamp('question_created_at', { withTimezone: true, mode: 'date' }),
		s3Etag: text('s3_etag'),
		contentHash: text('content_hash'),
		contentLength: integer('content_length'),
		metadataSyncedAt: timestamp('metadata_synced_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('question_registry_kind_class_unit_idx').on(table.kind, table.apClass, table.unit),
		index('question_registry_question_created_idx').on(table.questionCreatedAt),
		index('question_registry_content_hash_idx').on(table.contentHash)
	]
);

export const mcqQuestions = contentSchema.table(
	'mcq_questions',
	{
		questionId: text('question_id')
			.primaryKey()
			.references(() => questionRegistry.questionId, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull().default('all-units'),
		contentHash: text('content_hash').notNull(),
		topicsCovered: text('topics_covered'),
		question: text('question').notNull(),
		optionA: text('option_a').notNull(),
		optionB: text('option_b').notNull(),
		optionC: text('option_c').notNull(),
		optionD: text('option_d').notNull(),
		correctAnswer: text('correct_answer').notNull(),
		explanation: text('explanation').notNull(),
		hint1: text('hint_1'),
		hint2: text('hint_2'),
		randomKey: real('random_key').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mcq_questions_bucket_created_idx').on(table.apClass, table.unit, table.createdAt),
		index('mcq_questions_bucket_random_idx').on(table.apClass, table.unit, table.active, table.randomKey),
		uniqueIndex('mcq_questions_content_hash_uq').on(table.contentHash)
	]
);

export const frqQuestions = contentSchema.table(
	'frq_questions',
	{
		questionId: text('question_id')
			.primaryKey()
			.references(() => questionRegistry.questionId, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		formatId: text('format_id').notNull(),
		profileVersion: text('profile_version').notNull(),
		promptVersion: text('prompt_version').notNull(),
		rubricVersion: text('rubric_version').notNull(),
		schemaVersion: integer('schema_version').notNull(),
		prompt: text('prompt').notNull(),
		totalPoints: real('total_points').notNull(),
		topicsCovered: text('topics_covered').notNull(),
		contentHash: text('content_hash').notNull(),
		randomKey: real('random_key').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('frq_questions_bucket_created_idx').on(table.apClass, table.unit, table.createdAt),
		index('frq_questions_bucket_random_idx').on(table.apClass, table.unit, table.active, table.randomKey),
		uniqueIndex('frq_questions_content_hash_uq').on(table.contentHash)
	]
);

export const frqMaterials = contentSchema.table(
	'frq_materials',
	{
		questionId: text('question_id')
			.notNull()
			.references(() => frqQuestions.questionId, { onDelete: 'cascade' }),
		materialId: text('material_id').notNull(),
		title: text('title'),
		content: text('content').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.questionId, table.materialId] })]
);

export const frqSections = contentSchema.table(
	'frq_sections',
	{
		questionId: text('question_id')
			.notNull()
			.references(() => frqQuestions.questionId, { onDelete: 'cascade' }),
		sectionId: text('section_id').notNull(),
		label: text('label').notNull(),
		prompt: text('prompt').notNull(),
		responseKind: text('response_kind').notNull(),
		maxPoints: real('max_points').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.questionId, table.sectionId] })]
);

export const frqRubricCriteria = contentSchema.table(
	'frq_rubric_criteria',
	{
		questionId: text('question_id')
			.notNull()
			.references(() => frqQuestions.questionId, { onDelete: 'cascade' }),
		criterionId: text('criterion_id').notNull(),
		sectionId: text('section_id').notNull(),
		label: text('label').notNull(),
		maxPoints: real('max_points').notNull(),
		referenceAnswer: text('reference_answer').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.questionId, table.criterionId] })]
);

export const frqRubricLevels = contentSchema.table(
	'frq_rubric_levels',
	{
		questionId: text('question_id').notNull(),
		criterionId: text('criterion_id').notNull(),
		points: real('points').notNull(),
		description: text('description').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.questionId, table.criterionId, table.points] })]
);

export const questionRecentTopics = contentSchema.table(
	'question_recent_topics',
	{
		id: text('id').primaryKey(),
		kind: text('kind').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		topicsCovered: text('topics_covered').notNull(),
		questionId: text('question_id'),
		createdAt: createdAt()
	},
	(table) => [index('question_recent_topics_bucket_created_idx').on(table.kind, table.apClass, table.unit, table.createdAt)]
);

/** Rollups replace the three Mongo counter collections and are always derived. */
export const questionGenerationByClass = contentSchema
	.view('question_generation_by_class', {
		apClass: text('ap_class').notNull(),
		count: integer('count').notNull(),
		totalQuestionChars: integer('total_question_chars').notNull()
	})
	.as(
	sql`SELECT ap_class, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY ap_class`
);

export const questionGenerationByUnit = contentSchema
	.view('question_generation_by_unit', {
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		count: integer('count').notNull(),
		totalQuestionChars: integer('total_question_chars').notNull()
	})
	.as(
	sql`SELECT ap_class, unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY ap_class, unit`
);

export const questionGenerationByGlobalUnit = contentSchema
	.view('question_generation_by_global_unit', {
		unit: text('unit').notNull(),
		count: integer('count').notNull(),
		totalQuestionChars: integer('total_question_chars').notNull()
	})
	.as(
	sql`SELECT unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY unit`
);

// Quality data is split into current state, feedback facts, and append-only
// audit/batch rows. Assessments remain JSONB because their versioned shape is
// part of the review payload rather than a serving/query dimension.
export const questionQuality = contentSchema.table(
	'question_quality',
	{
		questionId: text('question_id')
			.primaryKey()
			.references(() => questionRegistry.questionId, { onDelete: 'cascade' }),
		sourceHash: text('source_hash'),
		sourceEtag: text('source_etag'),
		sourceCreatedAt: timestamp('source_created_at', { withTimezone: true, mode: 'date' }),
		apClass: text('ap_class'),
		unit: text('unit'),
		state: text('state').notNull().default('unreviewed'),
		aiAssessment: jsonb('ai_assessment').$type<Record<string, unknown>>(),
		humanAssessment: jsonb('human_assessment').$type<Record<string, unknown>>(),
		finalVerdict: text('final_verdict'),
		finalSource: text('final_source'),
		finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'date' }),
		needsHumanReview: boolean('needs_human_review').notNull().default(false),
		humanReviewReason: text('human_review_reason'),
		blindHumanReview: boolean('blind_human_review').notNull().default(false),
		answerIncorrectCount: integer('answer_incorrect_count').notNull().default(0),
		questionUnclearCount: integer('question_unclear_count').notNull().default(0),
		explanationUnclearCount: integer('explanation_unclear_count').notNull().default(0),
		uniqueReporters: integer('unique_reporters').notNull().default(0),
		feedbackPriority: text('feedback_priority').notNull().default('none'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('question_quality_state_idx').on(table.state),
		index('question_quality_review_idx').on(table.needsHumanReview),
		index('question_quality_verdict_idx').on(table.finalVerdict)
	]
);

export const questionQualityAudits = contentSchema.table(
	'question_quality_audits',
	{
		id: text('id').primaryKey(),
		questionId: text('question_id')
			.notNull()
			.references(() => questionQuality.questionId, { onDelete: 'cascade' }),
		at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull(),
		actorId: text('actor_id').notNull(),
		action: text('action').notNull(),
		fromVerdict: text('from_verdict'),
		toVerdict: text('to_verdict'),
		note: text('note')
	},
	(table) => [index('question_quality_audits_question_at_idx').on(table.questionId, table.at)]
);

export const questionFeedback = contentSchema.table(
	'question_feedback',
	{
		id: text('id').primaryKey(),
		questionId: text('question_id')
			.notNull()
			.references(() => questionRegistry.questionId, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		apClass: text('ap_class'),
		unit: text('unit'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('question_feedback_user_question_type_uq').on(table.questionId, table.userId, table.type),
		index('question_feedback_question_idx').on(table.questionId)
	]
);

export const qualityReviewJobs = contentSchema.table(
	'quality_review_jobs',
	{
		id: text('id').primaryKey(),
		status: text('status').notNull(),
		filters: jsonb('filters').$type<Record<string, unknown>>().notNull(),
		selectedCount: integer('selected_count').notNull().default(0),
		skippedCount: integer('skipped_count').notNull().default(0),
		queuedCount: integer('queued_count').notNull().default(0),
		submittedCount: integer('submitted_count').notNull().default(0),
		awaitingHumanCount: integer('awaiting_human_count').notNull().default(0),
		finalCount: integer('final_count').notNull().default(0),
		failedCount: integer('failed_count').notNull().default(0),
		estimatedInputTokens: integer('estimated_input_tokens').notNull().default(0),
		estimatedOutputTokens: integer('estimated_output_tokens').notNull().default(0),
		estimatedMaximumCostUsd: numeric('estimated_maximum_cost_usd', { precision: 12, scale: 6, mode: 'number' }).notNull().default(0),
		actualCostUsd: numeric('actual_cost_usd', { precision: 12, scale: 6, mode: 'number' }).notNull().default(0),
		model: text('model').notNull(),
		rubricVersion: text('rubric_version').notNull(),
		calibrated: boolean('calibrated').notNull().default(false),
		createdBy: text('created_by').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
		activeBatchId: text('active_batch_id'),
		activeInputFileId: text('active_input_file_id'),
		activeOutputFileId: text('active_output_file_id'),
		activeSubmissionKey: text('active_submission_key'),
		processingLeaseUntil: timestamp('processing_lease_until', { withTimezone: true, mode: 'date' }),
		submissionLeaseUntil: timestamp('submission_lease_until', { withTimezone: true, mode: 'date' }),
		error: text('error'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('quality_review_jobs_status_idx').on(table.status)]
);

export const qualityReviewJobCandidates = contentSchema.table(
	'quality_review_job_candidates',
	{
		jobId: text('job_id')
			.notNull()
			.references(() => qualityReviewJobs.id, { onDelete: 'cascade' }),
		questionId: text('question_id')
			.notNull()
			.references(() => questionRegistry.questionId, { onDelete: 'restrict' }),
		position: integer('position').notNull(),
		selected: boolean('selected').notNull().default(true)
	},
	(table) => [primaryKey({ columns: [table.jobId, table.questionId] })]
);

export const qualityReviewJobItems = contentSchema.table(
	'quality_review_job_items',
	{
		id: text('id').primaryKey(),
		jobId: text('job_id')
			.notNull()
			.references(() => qualityReviewJobs.id, { onDelete: 'cascade' }),
		questionId: text('question_id')
			.notNull()
			.references(() => questionRegistry.questionId, { onDelete: 'restrict' }),
		status: text('status').notNull(),
		attempts: integer('attempts').notNull().default(0),
		batchId: text('batch_id'),
		submissionKey: text('submission_key'),
		blind: boolean('blind').notNull().default(false),
		requiresWebSearch: boolean('requires_web_search').notNull().default(true),
		error: text('error'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('quality_review_job_items_question_uq').on(table.questionId),
		index('quality_review_job_items_job_status_idx').on(table.jobId, table.status)
	]
);

export const qualityReviewBatches = contentSchema.table(
	'quality_review_batches',
	{
		id: text('id').primaryKey(),
		jobId: text('job_id')
			.notNull()
			.references(() => qualityReviewJobs.id, { onDelete: 'cascade' }),
		submissionKey: text('submission_key').notNull(),
		inputFileId: text('input_file_id').notNull(),
		batchId: text('batch_id'),
		status: text('status').notNull(),
		outputFileId: text('output_file_id'),
		errorFileId: text('error_file_id'),
		createdAt: createdAt(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' })
	},
	(table) => [uniqueIndex('quality_review_batches_submission_key_uq').on(table.submissionKey)]
);

// Operational state and migration bookkeeping. These rows deliberately do not
// cascade from auth users where a cleanup job must survive account deletion.
export const poolRefillStates = opsSchema.table(
	'pool_refill_states',
	{
		id: text('id').primaryKey(),
		questionType: text('question_type').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		status: text('status').notNull(),
		target: integer('target').notNull(),
		observedCount: integer('observed_count').notNull().default(0),
		requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).notNull(),
		leaseOwner: text('lease_owner'),
		leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
		attempts: integer('attempts').notNull().default(0),
		generatedCount: integer('generated_count').notNull().default(0),
		lastError: text('last_error'),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }),
		lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('pool_refill_states_bucket_uq').on(table.questionType, table.apClass, table.unit),
		index('pool_refill_states_claim_idx').on(table.status, table.nextAttemptAt, table.leaseExpiresAt)
	]
);

export const poolBucketWriteLocks = opsSchema.table(
	'pool_bucket_write_locks',
	{
		id: text('id').primaryKey(),
		questionType: text('question_type').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		leaseOwner: text('lease_owner'),
		leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('pool_bucket_write_locks_bucket_uq').on(table.questionType, table.apClass, table.unit)]
);

export const poolGenerationBudgets = opsSchema.table(
	'pool_generation_budgets',
	{
		dayKey: text('day_key').primaryKey(),
		generations: integer('generations').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	}
);

/** Immutable source rollups retained for migration audit; serving uses views. */
export const generationRollupSnapshots = opsSchema.table(
	'generation_rollup_snapshots',
	{
		id: text('id').primaryKey(),
		sourceCollection: text('source_collection').notNull(),
		apClass: text('ap_class'),
		unit: text('unit'),
		count: integer('count').notNull(),
		totalQuestionChars: integer('total_question_chars').notNull(),
		createdAt: createdAt()
	},
	(table) => [uniqueIndex('generation_rollup_snapshots_source_uq').on(table.sourceCollection, table.apClass, table.unit)]
);

export const superCleanupJobs = opsSchema.table(
	'super_cleanup_jobs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		mem0UserId: text('mem0_user_id').notNull(),
		kind: text('kind').notNull(),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }).notNull(),
		attempts: integer('attempts').notNull().default(0),
		lastError: text('last_error'),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('super_cleanup_jobs_claim_idx').on(table.nextAttemptAt, table.completedAt),
		index('super_cleanup_jobs_user_kind_idx').on(table.userId, table.kind, table.completedAt)
	]
);

export const migrationRuns = opsSchema.table(
	'migration_runs',
	{
		id: text('id').primaryKey(),
		phase: text('phase').notNull(),
		status: text('status').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
		options: jsonb('options').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
		error: text('error')
	}
);

export const betterAuthMigrationMap = opsSchema.table(
	'better_auth_migration_map',
	{
		legacyUserId: text('legacy_user_id').primaryKey(),
		betterAuthUserId: text('better_auth_user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'restrict' }),
		email: text('email').notNull(),
		hasCredential: boolean('has_credential').notNull(),
		hasGoogle: boolean('has_google').notNull(),
		migratedAt: timestamp('migrated_at', { withTimezone: true, mode: 'date' }).notNull(),
		status: text('status').notNull()
	},
	(table) => [index('better_auth_migration_map_better_auth_user_idx').on(table.betterAuthUserId)]
);

export const legacyDocuments = opsSchema.table(
	'legacy_documents',
	{
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		document: jsonb('document').$type<Record<string, unknown>>().notNull(),
		archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [primaryKey({ columns: [table.sourceCollection, table.sourceId] }), index('legacy_documents_run_idx').on(table.runId)]
);

export const migrationTransforms = opsSchema.table(
	'migration_transforms',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		fieldPaths: text('field_paths').array().notNull(),
		transformation: text('transformation').notNull(),
		createdAt: createdAt()
	},
	(table) => [index('migration_transforms_run_idx').on(table.runId, table.sourceCollection)]
);

export const schemaMigrations = opsSchema.table('schema_migrations', {
		id: text('id').primaryKey(),
		checksum: text('checksum').notNull(),
		appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	});

export const migrationLedger = opsSchema.table(
	'migration_ledger',
	{
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		targetTable: text('target_table').notNull(),
		targetId: text('target_id').notNull(),
		checksum: text('checksum').notNull(),
		migratedAt: timestamp('migrated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.sourceCollection, table.sourceId, table.targetTable] }),
		index('migration_ledger_run_idx').on(table.runId)
	]
);

export const migrationRejects = opsSchema.table(
	'migration_rejects',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id'),
		reason: text('reason').notNull(),
		document: jsonb('document').$type<Record<string, unknown>>().notNull(),
		createdAt: createdAt()
	},
	(table) => [index('migration_rejects_run_collection_idx').on(table.runId, table.sourceCollection)]
);

export const schema = {
	authUsers,
	authSessions,
	authAccounts,
	authVerifications,
	authSubscriptions,
	authRateLimits,
	userProfiles,
	userSubjects,
	mcqAttempts,
	userProgress,
	bookmarks,
	experimentAssignments,
	referrals,
	frqAttempts,
	frqAttemptGrades,
	frqAttemptCriterionGrades,
	tutorProfiles,
	tutorProfileClasses,
	tutorTargetDates,
	superBillingAccess,
	superGrants,
	superUsageRollups,
	insightReports,
	studyPlans,
	studyTasks,
	studyPlanAudits,
	coachAudits,
	conversations,
	conversationMessages,
	seenQuestions,
	questionRegistry,
	mcqQuestions,
	frqQuestions,
	frqMaterials,
	frqSections,
	frqRubricCriteria,
	frqRubricLevels,
	questionRecentTopics,
	questionGenerationByClass,
	questionGenerationByUnit,
	questionGenerationByGlobalUnit,
	questionQuality,
	questionQualityAudits,
	questionFeedback,
	qualityReviewJobs,
	qualityReviewJobCandidates,
	qualityReviewJobItems,
	qualityReviewBatches,
	poolRefillStates,
	poolBucketWriteLocks,
	poolGenerationBudgets,
	generationRollupSnapshots,
	superCleanupJobs,
	migrationRuns,
	betterAuthMigrationMap,
	legacyDocuments,
	migrationTransforms,
	schemaMigrations,
	migrationLedger,
	migrationRejects
};

export const betterAuthSchema = {
	authUsers,
	authSessions,
	authAccounts,
	authVerifications,
	authSubscriptions,
	rateLimit: authRateLimits
};
