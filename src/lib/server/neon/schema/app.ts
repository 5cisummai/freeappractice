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
import { authUsers } from './auth';
import { createdAt, updatedAt, bytea } from './common';

export const appSchema = pgSchema('app');

// User-owned application data. Arrays and JSONB are limited to values that
// are genuinely document-shaped; facts that are queried or joined are rows.
export const userProfiles = appSchema.table(
	'user_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		referralCode: text('referral_code'),
		subjects: text('subjects')
			.array()
			.notNull()
			.default(sql`ARRAY[]::text[]`),
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

export const quizAttempts = appSchema.table(
	'quiz_attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		apClass: text('ap_class').notNull(),
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
		index('quiz_attempts_user_class_unit_idx').on(table.userId, table.apClass, table.unit)
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
		title: text('title').notNull(),
		apClass: text('ap_class').notNull(),
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
		index('shared_practice_sets_creator_idx').on(table.creatorUserId, table.createdAt)
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
		index('super_grants_user_expiry_idx').on(table.userId, table.startsAt, table.expiresAt)
	]
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
