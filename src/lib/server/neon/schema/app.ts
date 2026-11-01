import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ExamSection } from '#lib/exams/session.js';
import type { FrqGrade } from '#lib/question-bank/frq/types.js';
import { authOrganizations, authUsers } from './auth';
import { createdAt, updatedAt } from './common';

export const appSchema = pgSchema('app');

export const emailDeliveries = appSchema.table(
	'email_deliveries',
	{
		id: text('id').primaryKey(),
		emailType: text('email_type').notNull(),
		status: text('status').notNull().default('pending'),
		resendEmailId: text('resend_email_id'),
		lastEventType: text('last_event_type'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check(
			'email_deliveries_email_type_check',
			sql`${table.emailType} IN ('verification', 'password_reset', 'email_change', 'account_deletion', 'existing_signup', 'organization_invitation')`
		),
		check('email_deliveries_status_check', sql`${table.status} IN ('pending', 'sent', 'failed')`),
		uniqueIndex('email_deliveries_resend_email_id_uq').on(table.resendEmailId),
		index('email_deliveries_created_idx').on(table.createdAt)
	]
);

export const resendWebhookEvents = appSchema.table(
	'resend_webhook_events',
	{
		svixId: text('svix_id').primaryKey(),
		deliveryId: text('delivery_id'),
		resendEmailId: text('resend_email_id'),
		eventType: text('event_type').notNull(),
		eventCreatedAt: timestamp('event_created_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt()
	},
	(table) => [
		index('resend_webhook_events_delivery_idx').on(table.deliveryId),
		index('resend_webhook_events_email_idx').on(table.resendEmailId)
	]
);

export const bugReports = appSchema.table(
	'bug_reports',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => authUsers.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description').notNull(),
		steps: text('steps'),
		expected: text('expected'),
		severity: text('severity').notNull(),
		email: text('email'),
		metadata: jsonb('metadata')
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		createdAt: createdAt()
	},
	(table) => [
		check('bug_reports_severity_check', sql`${table.severity} IN ('low', 'medium', 'high')`),
		index('bug_reports_created_idx').on(table.createdAt),
		index('bug_reports_user_idx').on(table.userId)
	]
);

export const appFeedback = appSchema.table(
	'app_feedback',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => authUsers.id, { onDelete: 'cascade' }),
		category: text('category').notNull(),
		message: text('message').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check(
			'app_feedback_category_check',
			sql`${table.category} IN ('general', 'bug', 'feature_request', 'content', 'other')`
		),
		index('app_feedback_created_idx').on(table.createdAt),
		index('app_feedback_user_idx').on(table.userId)
	]
);

// User-owned application data. Arrays and JSONB are limited to values that
// are genuinely document-shaped; facts that are queried or joined are rows.
export const userProfiles = appSchema.table('user_profiles', {
	userId: text('user_id')
		.primaryKey()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	assistantFeaturesEnabled: boolean('assistant_features_enabled').notNull().default(true),
	courses: text('courses')
		.array()
		.notNull()
		.default(sql`ARRAY[]::text[]`),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const userCourses = appSchema.table(
	'user_courses',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		course: text('course').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: createdAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.course] })]
);

export type PracticeSessionQuestionReference = {
	questionId: string;
	questionType: 'mcq' | 'frq';
};

export const practiceSessions = appSchema.table(
	'practice_sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		mode: text('mode').notNull(),
		course: text('course'),
		status: text('status').notNull().default('open'),
		startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
		questionRefs: jsonb('question_refs')
			.$type<PracticeSessionQuestionReference[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('practice_sessions_mode_check', sql`${table.mode} IN ('mcq', 'quiz', 'frq', 'exam')`),
		check(
			'practice_sessions_status_check',
			sql`${table.status} IN ('open', 'completed', 'cancelled')`
		),
		index('practice_sessions_user_started_idx').on(table.userId, table.startedAt),
		index('practice_sessions_org_started_idx').on(table.organizationId, table.startedAt)
	]
);

export const mcqAttempts = appSchema.table(
	'mcq_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		practiceSessionId: text('practice_session_id').references(() => practiceSessions.id, {
			onDelete: 'set null'
		}),
		questionId: text('question_id').notNull(),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		selectedAnswer: text('selected_answer'),
		wasCorrect: boolean('was_correct'),
		timeTakenMs: integer('time_taken_ms'),
		attemptedAt: timestamp('attempted_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt()
	},
	(table) => [
		index('mcq_attempts_user_attempted_idx').on(table.userId, table.attemptedAt),
		index('mcq_attempts_org_attempted_idx').on(table.organizationId, table.attemptedAt),
		index('mcq_attempts_session_idx').on(table.practiceSessionId),
		index('mcq_attempts_question_idx').on(table.questionId),
		index('mcq_attempts_user_course_unit_idx').on(table.userId, table.course, table.unit)
	]
);

export const examAttempts = appSchema.table(
	'exam_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		practiceSessionId: text('practice_session_id').references(() => practiceSessions.id, {
			onDelete: 'set null'
		}),
		course: text('course').notNull(),
		sections: jsonb('sections').$type<ExamSection[]>().notNull(),
		responses: jsonb('responses').$type<Record<string, string>>().notNull().default({}),
		sectionIndex: integer('section_index').notNull().default(0),
		sectionStartedAt: timestamp('section_started_at', { withTimezone: true, mode: 'date' }),
		sectionCompletedAt: jsonb('section_completed_at')
			.$type<(string | null)[]>()
			.notNull()
			.default([]),
		grading: jsonb('grading').$type<Record<string, unknown>>().notNull().default({}),
		status: text('status').notNull().default('in_progress'),
		revision: integer('revision').notNull().default(0),
		score: jsonb('score').$type<Record<string, unknown>>(),
		startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
		updatedAt: updatedAt()
	},
	(table) => [
		check('exam_attempts_status_check', sql`${table.status} IN ('in_progress', 'submitted')`),
		index('exam_attempts_org_started_idx').on(table.organizationId, table.startedAt),
		index('exam_attempts_session_idx').on(table.practiceSessionId),
		index('exam_attempts_user_started_idx').on(table.userId, table.startedAt)
	]
);

export const quizAttempts = appSchema.table(
	'quiz_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		practiceSessionId: text('practice_session_id').references(() => practiceSessions.id, {
			onDelete: 'set null'
		}),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		requestedCount: integer('requested_count').notNull(),
		answeredCount: integer('answered_count').notNull(),
		correctCount: integer('correct_count').notNull(),
		incorrectCount: integer('incorrect_count').notNull(),
		scorePercent: integer('score_percent').notNull(),
		timeTakenMs: integer('time_taken_ms'),
		startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }).notNull(),
		sharedPracticeSetId: text('shared_practice_set_id').references(
			(): AnyPgColumn => sharedPracticeSets.id,
			{ onDelete: 'set null' }
		),
		createdAt: createdAt()
	},
	(table) => [
		index('quiz_attempts_user_completed_idx').on(table.userId, table.completedAt),
		index('quiz_attempts_org_completed_idx').on(table.organizationId, table.completedAt),
		index('quiz_attempts_session_idx').on(table.practiceSessionId),
		index('quiz_attempts_user_course_unit_idx').on(table.userId, table.course, table.unit)
	]
);

export const sharedPracticeSets = appSchema.table(
	'shared_practice_sets',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		kind: text('kind').notNull().default('quiz'),
		creatorUserId: text('creator_user_id').references(() => authUsers.id, {
			onDelete: 'set null'
		}),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		title: text('title').notNull(),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		itemCount: integer('item_count').notNull(),
		status: text('status').notNull().default('active'),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('shared_practice_sets_kind_check', sql`${table.kind} = 'quiz'`),
		check('shared_practice_sets_status_check', sql`${table.status} IN ('active', 'revoked')`),
		uniqueIndex('shared_practice_sets_slug_uq').on(table.slug),
		index('shared_practice_sets_status_expiry_idx').on(table.status, table.expiresAt),
		index('shared_practice_sets_creator_idx').on(table.creatorUserId, table.createdAt),
		index('shared_practice_sets_org_idx').on(table.organizationId, table.createdAt)
	]
);

export const sharedPracticeSetItems = appSchema.table(
	'shared_practice_set_items',
	{
		sharedPracticeSetId: text('shared_practice_set_id')
			.notNull()
			.references(() => sharedPracticeSets.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		itemType: text('item_type').notNull().default('mcq'),
		questionId: text('question_id').notNull(),
		questionContentHash: text('question_content_hash')
	},
	(table) => [
		primaryKey({ columns: [table.sharedPracticeSetId, table.position] }),
		uniqueIndex('shared_practice_set_items_question_uq').on(
			table.sharedPracticeSetId,
			table.questionId
		),
		index('shared_practice_set_items_question_idx').on(table.questionId)
	]
);

export const quizAttemptQuestions = appSchema.table(
	'quiz_attempt_questions',
	{
		quizAttemptId: text('quiz_attempt_id')
			.notNull()
			.references(() => quizAttempts.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		questionId: text('question_id').notNull(),
		selectedAnswer: text('selected_answer'),
		wasCorrect: boolean('was_correct'),
		timeTakenMs: integer('time_taken_ms')
	},
	(table) => [
		primaryKey({ columns: [table.quizAttemptId, table.position] }),
		index('quiz_attempt_questions_question_idx').on(table.questionId)
	]
);

export const userProgress = appSchema.table(
	'user_progress',
	{
		id: text('id')
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		course: text('course').notNull(),
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
		uniqueIndex('user_progress_personal_uq')
			.on(table.userId, table.course, table.unit)
			.where(sql`${table.organizationId} IS NULL`),
		uniqueIndex('user_progress_classroom_uq')
			.on(table.organizationId, table.userId, table.course, table.unit)
			.where(sql`${table.organizationId} IS NOT NULL`),
		check('user_progress_mastery_range', sql`${table.mastery} >= 0 AND ${table.mastery} <= 100`)
	]
);

export const bookmarks = appSchema.table(
	'bookmarks',
	{
		id: text('id')
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		questionId: text('question_id').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('bookmarks_personal_uq')
			.on(table.userId, table.questionId)
			.where(sql`${table.organizationId} IS NULL`),
		uniqueIndex('bookmarks_classroom_uq')
			.on(table.organizationId, table.userId, table.questionId)
			.where(sql`${table.organizationId} IS NOT NULL`)
	]
);

export const frqAttempts = appSchema.table(
	'frq_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		practiceSessionId: text('practice_session_id').references(() => practiceSessions.id, {
			onDelete: 'set null'
		}),
		submissionId: text('submission_id').notNull(),
		questionId: text('question_id').notNull(),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		formatId: text('format_id').notNull(),
		responses: jsonb('responses').$type<Record<string, string>>().notNull(),
		status: text('status').notNull(),
		timeTakenMs: integer('time_taken_ms').notNull(),
		pointsEarned: real('points_earned'),
		pointsAvailable: real('points_available'),
		percentage: real('percentage'),
		grade: jsonb('grade').$type<FrqGrade>(),
		gradingModel: text('grading_model'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('frq_attempts_personal_submission_uq')
			.on(table.userId, table.submissionId)
			.where(sql`${table.organizationId} IS NULL`),
		uniqueIndex('frq_attempts_classroom_submission_uq')
			.on(table.organizationId, table.userId, table.submissionId)
			.where(sql`${table.organizationId} IS NOT NULL`),
		index('frq_attempts_org_created_idx').on(table.organizationId, table.createdAt),
		index('frq_attempts_user_created_idx').on(table.userId, table.createdAt),
		index('frq_attempts_user_course_unit_idx').on(table.userId, table.course, table.unit)
	]
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
		memoryDisclosureSeenAt: timestamp('memory_disclosure_seen_at', {
			withTimezone: true,
			mode: 'date'
		}),
		superFreeBetaClaimedAt: timestamp('super_free_beta_claimed_at', {
			withTimezone: true,
			mode: 'date'
		}),
		superAccessStartedAt: timestamp('super_access_started_at', {
			withTimezone: true,
			mode: 'date'
		}),
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
		course: text('course').notNull(),
		position: integer('position').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.userId, table.course] })]
);

export const tutorTargetDates = appSchema.table(
	'tutor_target_dates',
	{
		userId: text('user_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
		course: text('course').notNull(),
		targetDate: date('target_date', { mode: 'date' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.course] })]
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
		lastStripeEventCreated: timestamp('last_stripe_event_created', {
			withTimezone: true,
			mode: 'date'
		}),
		lastBillingEventCreated: timestamp('last_billing_event_created', {
			withTimezone: true,
			mode: 'date'
		}),
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
	(table) => [
		index('super_grants_user_expiry_idx').on(table.userId, table.startsAt, table.expiresAt),
		uniqueIndex('super_grants_user_indefinite_unrevoked_uq')
			.on(table.userId)
			.where(
				sql`${table.revokedAt} is null and ${table.expiresAt} >= '9999-12-31 23:59:59+00'::timestamptz`
			)
	]
);

export const superUsageRollups = appSchema.table(
	'super_usage_rollups',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		month: text('month').notNull(),
		creditsMilli: integer('credits_milli').notNull().default(0),
		updatedAt: updatedAt()
	},
	(table) => [primaryKey({ columns: [table.userId, table.month] })]
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
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		mode: text('mode').notNull(),
		taskDate: date('task_date', { mode: 'date' }).notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		status: text('status').notNull().default('todo'),
		practiceHref: text('practice_href')
	},
	(table) => [index('study_tasks_plan_date_idx').on(table.planId, table.taskDate)]
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
		conversationId: text('conversation_id'),
		messageId: text('message_id'),
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
		surface: text('surface').notNull().default('coach'),
		context: jsonb('context')
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
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
		parts: jsonb('parts')
			.$type<unknown[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		status: text('status').notNull().default('complete'),
		clientMessageId: text('client_message_id'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('conversation_messages_conversation_position_uq').on(
			table.conversationId,
			table.position
		),
		uniqueIndex('conversation_messages_conversation_client_uq').on(
			table.conversationId,
			table.clientMessageId
		),
		index('conversation_messages_conversation_created_idx').on(
			table.conversationId,
			table.createdAt
		)
	]
);

// These rows survive chat/account deletion as a durable object-deletion queue.
// SET NULL happens atomically with deletion, before message metadata disappears.
export const coachImages = appSchema.table(
	'coach_images',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		conversationId: text('conversation_id').references(() => conversations.id, {
			onDelete: 'set null'
		}),
		messageId: text('message_id').references(() => conversationMessages.id, {
			onDelete: 'set null'
		}),
		store: text('store').notNull(),
		pathname: text('pathname').notNull(),
		createdAt: createdAt(),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
		attempts: integer('attempts').notNull().default(0)
	},
	(table) => [
		index('coach_images_owner_conversation_idx').on(table.userId, table.conversationId),
		index('coach_images_cleanup_idx').on(table.nextAttemptAt),
		check('coach_images_store_check', sql`${table.store} IN ('blob', 's3')`)
	]
);

export const seenQuestions = appSchema.table(
	'seen_questions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => authOrganizations.id, {
			onDelete: 'cascade'
		}),
		contentHash: text('content_hash').notNull(),
		questionType: text('question_type').notNull(),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }).notNull()
	},
	(table) => [
		index('seen_questions_user_seen_idx').on(table.userId, table.seenAt),
		index('seen_questions_org_seen_idx').on(table.organizationId, table.seenAt),
		index('seen_questions_user_hash_idx').on(table.userId, table.contentHash)
	]
);

export const organizationActivityPreferences = appSchema.table(
	'organization_activity_preferences',
	{
		organizationId: text('organization_id')
			.notNull()
			.references(() => authOrganizations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		enabled: boolean('enabled').notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		primaryKey({ columns: [table.organizationId, table.userId] }),
		index('organization_activity_preferences_user_idx').on(table.userId)
	]
);

export const practiceActivityEvents = appSchema.table(
	'practice_activity_events',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		sourceType: text('source_type').notNull(),
		sourceId: text('source_id').notNull(),
		course: text('course').notNull(),
		unit: text('unit').notNull(),
		scorePercent: integer('score_percent'),
		questionsAnswered: integer('questions_answered').notNull(),
		correctQuestions: integer('correct_questions').notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check(
			'practice_activity_events_source_type_check',
			sql`${table.sourceType} IN ('quiz', 'exam', 'frq')`
		),
		uniqueIndex('practice_activity_events_source_uq').on(table.sourceType, table.sourceId),
		index('practice_activity_events_completed_idx').on(table.completedAt)
	]
);

export const practiceActivityAudiences = appSchema.table(
	'practice_activity_audiences',
	{
		eventId: text('event_id')
			.notNull()
			.references(() => practiceActivityEvents.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id')
			.notNull()
			.references(() => authOrganizations.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.organizationId] }),
		index('practice_activity_audiences_org_idx').on(table.organizationId, table.createdAt)
	]
);

export const classroomCreationGrants = appSchema.table(
	'classroom_creation_grants',
	{
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		grantedBy: text('granted_by').notNull(),
		grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		primaryKey({ columns: [table.userId] }),
		index('classroom_creation_grants_active_idx')
			.on(table.userId)
			.where(sql`${table.revokedAt} IS NULL`)
	]
);

export const classroomCourses = appSchema.table(
	'classroom_courses',
	{
		organizationId: text('organization_id')
			.notNull()
			.references(() => authOrganizations.id, { onDelete: 'cascade' }),
		course: text('course').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: createdAt()
	},
	(table) => [
		primaryKey({ columns: [table.organizationId, table.course] }),
		index('classroom_courses_order_idx').on(table.organizationId, table.position)
	]
);

export const classroomEnrollmentHistory = appSchema.table(
	'classroom_enrollment_history',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => authOrganizations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull(),
		leftAt: timestamp('left_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt()
	},
	(table) => [
		check(
			'classroom_enrollment_history_role_check',
			sql`${table.role} IN ('owner', 'admin', 'member')`
		),
		index('classroom_enrollment_history_org_user_idx').on(table.organizationId, table.userId),
		index('classroom_enrollment_history_org_left_idx').on(table.organizationId, table.leftAt)
	]
);
