import {
	boolean,
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
import { authUsers } from './auth';
import { createdAt, updatedAt } from './common';
import type { FrqQuestion } from '$lib/question-bank/frq/types';

export const contentSchema = pgSchema('content');

export type McqQuestionPayload = {
	apClass: string;
	unit: string;
	topicsCovered: string;
	question: string;
	diagramSpec: Record<string, unknown> | null;
	hasDiagram: boolean;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	hint1: string | null;
	hint2: string | null;
};

export type FrqQuestionPayload = FrqQuestion;

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
		data: jsonb('data').$type<McqQuestionPayload>().notNull(),
		contentHash: text('content_hash').notNull(),
		randomKey: real('random_key').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mcq_questions_bucket_created_idx').on(
			sql`(${table.data} ->> 'apClass')`,
			sql`(${table.data} ->> 'unit')`,
			table.createdAt
		),
		index('mcq_questions_bucket_random_idx').on(
			sql`(${table.data} ->> 'apClass')`,
			sql`(${table.data} ->> 'unit')`,
			table.active,
			table.randomKey
		),
		uniqueIndex('mcq_questions_content_hash_uq').on(table.contentHash)
	]
);

export const frqQuestions = contentSchema.table(
	'frq_questions',
	{
		questionId: text('question_id')
			.primaryKey()
			.references(() => questionRegistry.questionId, { onDelete: 'cascade' }),
		data: jsonb('data').$type<FrqQuestionPayload>().notNull(),
		contentHash: text('content_hash').notNull(),
		randomKey: real('random_key').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('frq_questions_bucket_created_idx').on(
			sql`(${table.data} ->> 'apClass')`,
			sql`(${table.data} ->> 'unit')`,
			table.createdAt
		),
		index('frq_questions_bucket_random_idx').on(
			sql`(${table.data} ->> 'apClass')`,
			sql`(${table.data} ->> 'unit')`,
			table.active,
			table.randomKey
		),
		uniqueIndex('frq_questions_content_hash_uq').on(table.contentHash)
	]
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
	(table) => [
		index('question_recent_topics_bucket_created_idx').on(
			table.kind,
			table.apClass,
			table.unit,
			table.createdAt
		)
	]
);

/** Rollups replace the three legacy counter collections and are always derived. */
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
		uniqueIndex('question_feedback_user_question_type_uq').on(
			table.questionId,
			table.userId,
			table.type
		),
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
		estimatedMaximumCostUsd: numeric('estimated_maximum_cost_usd', {
			precision: 12,
			scale: 6,
			mode: 'number'
		})
			.notNull()
			.default(0),
		actualCostUsd: numeric('actual_cost_usd', { precision: 12, scale: 6, mode: 'number' })
			.notNull()
			.default(0),
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
