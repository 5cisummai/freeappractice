import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import type {
	AiQualityAssessment,
	FeedbackSummary,
	HumanQualityAssessment,
	QualityState,
	QualityVerdict,
	ReviewFilters,
	ReviewJobStatus
} from './types.js';
import {
	qualityReviewBatches,
	qualityReviewJobCandidates,
	qualityReviewJobItems,
	qualityReviewJobs,
	questionQuality
} from '$lib/server/neon/schema';
import { getNeonDatabase } from '$lib/server/neon/db';

export interface QuestionQualityDocument {
	questionId: string;
	sourceHash?: string;
	sourceEtag?: string;
	sourceCreatedAt?: Date;
	apClass?: string;
	unit?: string;
	state: QualityState;
	aiAssessment?: AiQualityAssessment;
	humanAssessment?: HumanQualityAssessment;
	finalVerdict?: QualityVerdict;
	finalSource?: 'ai' | 'human';
	finalizedAt?: Date;
	needsHumanReview: boolean;
	humanReviewReason?: string;
	blindHumanReview: boolean;
	feedbackSummary: FeedbackSummary;
	createdAt: Date;
	updatedAt: Date;
}

function feedbackSummaryFromRow(row: Record<string, unknown>): FeedbackSummary {
	return {
		answerIncorrect: Number(row.answerIncorrectCount ?? 0),
		questionUnclear: Number(row.questionUnclearCount ?? 0),
		explanationUnclear: Number(row.explanationUnclearCount ?? 0),
		uniqueReporters: Number(row.uniqueReporters ?? 0),
		priority: (row.feedbackPriority as FeedbackSummary['priority']) ?? 'none'
	};
}

function qualityFromRow(row: Record<string, unknown>): QuestionQualityDocument {
	return {
		...(row as unknown as QuestionQualityDocument),
		feedbackSummary: feedbackSummaryFromRow(row)
	};
}

export async function getQuestionQuality(
	questionId: string
): Promise<QuestionQualityDocument | null> {
	const [row] = await getNeonDatabase()
		.select()
		.from(questionQuality)
		.where(eq(questionQuality.questionId, questionId))
		.limit(1);
	return row ? qualityFromRow(row as Record<string, unknown>) : null;
}

export async function listAssessedQuestionIds(questionIds: string[]): Promise<string[]> {
	if (!questionIds.length) return [];
	const rows = await getNeonDatabase()
		.select({ questionId: questionQuality.questionId })
		.from(questionQuality)
		.where(
			and(inArray(questionQuality.questionId, questionIds), isNotNull(questionQuality.aiAssessment))
		);
	return rows.map((row) => row.questionId);
}

export async function listClaimedReviewQuestionIds(questionIds: string[]): Promise<string[]> {
	if (!questionIds.length) return [];
	const rows = await getNeonDatabase()
		.select({ questionId: qualityReviewJobItems.questionId })
		.from(qualityReviewJobItems)
		.where(
			and(
				inArray(qualityReviewJobItems.questionId, questionIds),
				ne(qualityReviewJobItems.status, 'failed')
			)
		);
	return rows.map((row) => row.questionId);
}

export async function ensureQuestionQuality(
	questionId: string,
	values: Partial<QuestionQualityDocument> = {}
): Promise<void> {
	await getNeonDatabase()
		.insert(questionQuality)
		.values({
			questionId,
			state: values.state ?? 'unreviewed',
			needsHumanReview: values.needsHumanReview ?? false,
			blindHumanReview: values.blindHumanReview ?? false,
			answerIncorrectCount: values.feedbackSummary?.answerIncorrect ?? 0,
			questionUnclearCount: values.feedbackSummary?.questionUnclear ?? 0,
			explanationUnclearCount: values.feedbackSummary?.explanationUnclear ?? 0,
			uniqueReporters: values.feedbackSummary?.uniqueReporters ?? 0,
			feedbackPriority: values.feedbackSummary?.priority ?? 'none'
		} as typeof questionQuality.$inferInsert)
		.onConflictDoNothing({ target: questionQuality.questionId });
}

export type QuestionQualityUpdate = Partial<{
	sourceHash: string | null;
	sourceEtag: string | null;
	sourceCreatedAt: Date | null;
	apClass: string | null;
	unit: string | null;
	state: QualityState;
	aiAssessment: AiQualityAssessment | null;
	humanAssessment: HumanQualityAssessment | null;
	finalVerdict: QualityVerdict | null;
	finalSource: 'ai' | 'human' | null;
	finalizedAt: Date | null;
	needsHumanReview: boolean;
	humanReviewReason: string | null;
	blindHumanReview: boolean;
	answerIncorrectCount: number;
	questionUnclearCount: number;
	explanationUnclearCount: number;
	uniqueReporters: number;
	feedbackPriority: string;
}>;

export async function updateQuestionQuality(
	questionId: string,
	values: QuestionQualityUpdate,
	options: { requireUnassessed?: boolean; requireHumanReview?: boolean } = {}
): Promise<{ matchedCount: number; modifiedCount: number }> {
	const conditions = [eq(questionQuality.questionId, questionId)];
	if (options.requireUnassessed) conditions.push(isNull(questionQuality.aiAssessment));
	if (options.requireHumanReview !== undefined) {
		conditions.push(eq(questionQuality.needsHumanReview, options.requireHumanReview));
	}
	const rows = await getNeonDatabase()
		.update(questionQuality)
		.set(values as typeof questionQuality.$inferInsert)
		.where(and(...conditions))
		.returning({ questionId: questionQuality.questionId });
	return { matchedCount: rows.length, modifiedCount: rows.length };
}

export interface ReviewJobDocument {
	id: string;
	status: ReviewJobStatus;
	filters: ReviewFilters;
	selectedQuestionIds: string[];
	selectedCount: number;
	skippedCount: number;
	queuedCount: number;
	submittedCount: number;
	awaitingHumanCount: number;
	finalCount: number;
	failedCount: number;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedMaximumCostUsd: number;
	actualCostUsd: number;
	model: string;
	rubricVersion: string;
	calibrated: boolean;
	createdBy: string;
	expiresAt?: Date;
	activeBatchId?: string;
	activeInputFileId?: string;
	activeOutputFileId?: string;
	activeSubmissionKey?: string;
	processingLeaseUntil?: Date;
	submissionLeaseUntil?: Date;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
	batches: Array<{
		submissionKey: string;
		inputFileId: string;
		batchId?: string;
		status: string;
		outputFileId?: string;
		errorFileId?: string;
		createdAt: Date;
		completedAt?: Date;
	}>;
}

function hydrateJob(
	row: Record<string, unknown>,
	candidates: Array<Record<string, unknown>>,
	batches: Array<Record<string, unknown>>
): ReviewJobDocument {
	return {
		...(row as unknown as Omit<ReviewJobDocument, 'id' | 'selectedQuestionIds' | 'batches'>),
		id: String(row.id),
		filters: (row.filters ?? {}) as ReviewFilters,
		selectedQuestionIds: candidates
			.filter((item) => item.selected)
			.map((item) => String(item.questionId)),
		batches: batches.map((item) => ({
			submissionKey: String(item.submissionKey),
			inputFileId: String(item.inputFileId),
			batchId: item.batchId ? String(item.batchId) : undefined,
			status: String(item.status),
			outputFileId: item.outputFileId ? String(item.outputFileId) : undefined,
			errorFileId: item.errorFileId ? String(item.errorFileId) : undefined,
			createdAt: item.createdAt as Date,
			completedAt: item.completedAt as Date | undefined
		}))
	};
}

export async function getReviewJob(jobId: string): Promise<ReviewJobDocument | null> {
	const db = getNeonDatabase();
	const [row] = await db
		.select()
		.from(qualityReviewJobs)
		.where(eq(qualityReviewJobs.id, jobId))
		.limit(1);
	if (!row) return null;
	const [candidates, batches] = await Promise.all([
		db
			.select()
			.from(qualityReviewJobCandidates)
			.where(eq(qualityReviewJobCandidates.jobId, jobId))
			.orderBy(asc(qualityReviewJobCandidates.position)),
		db
			.select()
			.from(qualityReviewBatches)
			.where(eq(qualityReviewBatches.jobId, jobId))
			.orderBy(asc(qualityReviewBatches.createdAt))
	]);
	return hydrateJob(
		row as Record<string, unknown>,
		candidates as Array<Record<string, unknown>>,
		batches as Array<Record<string, unknown>>
	);
}

const jobColumns = [
	'status',
	'filters',
	'selectedCount',
	'skippedCount',
	'queuedCount',
	'submittedCount',
	'awaitingHumanCount',
	'finalCount',
	'failedCount',
	'estimatedInputTokens',
	'estimatedOutputTokens',
	'estimatedMaximumCostUsd',
	'actualCostUsd',
	'model',
	'rubricVersion',
	'calibrated',
	'createdBy',
	'expiresAt',
	'activeBatchId',
	'activeInputFileId',
	'activeOutputFileId',
	'activeSubmissionKey',
	'processingLeaseUntil',
	'submissionLeaseUntil',
	'error'
] as const;

function jobValues(input: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		jobColumns
			.filter((column) => input[column] !== undefined)
			.map((column) => [column, input[column]])
	);
}

export async function createReviewJob(input: Record<string, unknown>): Promise<ReviewJobDocument> {
	const db = getNeonDatabase();
	const id = String(input.id ?? randomUUID());
	const selectedQuestionIds = Array.isArray(input.selectedQuestionIds)
		? input.selectedQuestionIds.map(String)
		: [];
	const batches = Array.isArray(input.batches) ? input.batches : [];
	const parentInsert = db
		.insert(qualityReviewJobs)
		.values({ ...jobValues({ ...input, id }), id } as typeof qualityReviewJobs.$inferInsert)
		.returning();
	const queries: unknown[] = [parentInsert];
	if (selectedQuestionIds.length) {
		queries.push(
			db.insert(qualityReviewJobCandidates).values(
				selectedQuestionIds.map((questionId, position) => ({
					jobId: id,
					questionId,
					position,
					selected: true
				}))
			)
		);
	}
	if (batches.length) {
		queries.push(
			db
				.insert(qualityReviewBatches)
				.values(
					batches.map((batch) => ({ id: randomUUID(), jobId: id, ...batch })) as Array<
						typeof qualityReviewBatches.$inferInsert
					>
				)
		);
	}
	await (db as any).batch(queries);
	const created = await getReviewJob(id);
	if (!created) throw new Error('PostgreSQL insert returned no job');
	return created;
}

export async function updateReviewJob(
	jobId: string,
	values: Record<string, unknown>,
	options: { status?: string; notStatus?: string } = {}
): Promise<number> {
	const conditions = [eq(qualityReviewJobs.id, jobId)];
	if (options.status) conditions.push(eq(qualityReviewJobs.status, options.status));
	if (options.notStatus) conditions.push(ne(qualityReviewJobs.status, options.notStatus));
	const rows = await getNeonDatabase()
		.update(qualityReviewJobs)
		.set({ ...jobValues(values), updatedAt: new Date() } as typeof qualityReviewJobs.$inferInsert)
		.where(and(...conditions))
		.returning({ id: qualityReviewJobs.id });
	return rows.length;
}

export async function updateReviewJobBatch(
	jobId: string,
	submissionKey: string,
	batch: { id: string; status: string }
): Promise<void> {
	const db = getNeonDatabase();
	await db.batch([
		db
			.update(qualityReviewJobs)
			.set({ activeBatchId: batch.id, updatedAt: new Date() })
			.where(and(eq(qualityReviewJobs.id, jobId), ne(qualityReviewJobs.status, 'cancelled'))),
		db
			.update(qualityReviewBatches)
			.set({ batchId: batch.id, status: batch.status })
			.where(
				and(
					eq(qualityReviewBatches.jobId, jobId),
					eq(qualityReviewBatches.submissionKey, submissionKey)
				)
			)
	]);
}

export async function appendReviewJobBatch(
	jobId: string,
	inputFileId: string,
	submissionKey: string
): Promise<void> {
	const db = getNeonDatabase();
	await db.batch([
		db
			.update(qualityReviewJobs)
			.set({
				activeInputFileId: inputFileId,
				activeSubmissionKey: submissionKey,
				updatedAt: new Date()
			})
			.where(eq(qualityReviewJobs.id, jobId)),
		db.insert(qualityReviewBatches).values({
			id: randomUUID(),
			jobId,
			submissionKey,
			inputFileId,
			status: 'uploaded',
			createdAt: new Date()
		})
	]);
}

export async function completeReviewJobBatch(
	jobId: string,
	batchId: string,
	status: string,
	outputFileId?: string,
	errorFileId?: string
): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewBatches)
		.set({ status, outputFileId, errorFileId, completedAt: new Date() })
		.where(and(eq(qualityReviewBatches.jobId, jobId), eq(qualityReviewBatches.batchId, batchId)));
}

export async function clearReviewJobBatch(jobId: string, outputFileId?: string): Promise<void> {
	await updateReviewJob(jobId, {
		activeBatchId: null,
		activeInputFileId: null,
		activeOutputFileId: outputFileId ?? null,
		activeSubmissionKey: null
	});
}

export async function listActiveReviewJobIds(): Promise<string[]> {
	const rows = await getNeonDatabase()
		.select({ id: qualityReviewJobs.id })
		.from(qualityReviewJobs)
		.where(inArray(qualityReviewJobs.status, ['preparing', 'in_progress']))
		.orderBy(asc(qualityReviewJobs.updatedAt))
		.limit(5);
	return rows.map((row) => row.id);
}

export interface ReviewJobItemDocument {
	id: string;
	jobId: string;
	questionId: string;
	status: 'queued' | 'preparing' | 'submitted' | 'awaiting_human' | 'final' | 'failed';
	attempts: number;
	batchId?: string;
	submissionKey?: string;
	blind: boolean;
	requiresWebSearch: boolean;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

function itemFromRow(row: Record<string, unknown>): ReviewJobItemDocument {
	return {
		...(row as unknown as ReviewJobItemDocument),
		id: String(row.id),
		jobId: String(row.jobId),
		questionId: String(row.questionId),
		status: row.status as ReviewJobItemDocument['status'],
		attempts: Number(row.attempts ?? 0),
		blind: Boolean(row.blind),
		requiresWebSearch: Boolean(row.requiresWebSearch)
	};
}

export async function getReviewJobItem(
	jobId: string,
	questionId: string
): Promise<ReviewJobItemDocument | null> {
	const [row] = await getNeonDatabase()
		.select()
		.from(qualityReviewJobItems)
		.where(
			and(eq(qualityReviewJobItems.jobId, jobId), eq(qualityReviewJobItems.questionId, questionId))
		)
		.limit(1);
	return row ? itemFromRow(row as Record<string, unknown>) : null;
}

export async function listReviewJobItems(input: {
	jobId: string;
	status?: ReviewJobItemDocument['status'];
	batchId?: string;
	limit?: number;
}): Promise<ReviewJobItemDocument[]> {
	const conditions = [eq(qualityReviewJobItems.jobId, input.jobId)];
	if (input.status) conditions.push(eq(qualityReviewJobItems.status, input.status));
	if (input.batchId) conditions.push(eq(qualityReviewJobItems.batchId, input.batchId));
	const rows = await getNeonDatabase()
		.select()
		.from(qualityReviewJobItems)
		.where(and(...conditions))
		.orderBy(asc(qualityReviewJobItems.createdAt))
		.limit(input.limit ?? 10_000);
	return rows.map((row) => itemFromRow(row as Record<string, unknown>));
}

export async function updateReviewJobItem(
	itemId: string,
	values: Partial<
		Pick<
			ReviewJobItemDocument,
			'status' | 'attempts' | 'batchId' | 'submissionKey' | 'blind' | 'requiresWebSearch'
		>
	> & {
		error?: string | null;
	},
	options: { status?: ReviewJobItemDocument['status'] } = {}
): Promise<ReviewJobItemDocument | null> {
	const conditions = [eq(qualityReviewJobItems.id, itemId)];
	if (options.status) conditions.push(eq(qualityReviewJobItems.status, options.status));
	const [row] = await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({ ...values, updatedAt: new Date() })
		.where(and(...conditions))
		.returning();
	return row ? itemFromRow(row as Record<string, unknown>) : null;
}

export async function updateReviewJobItemByQuestion(
	questionId: string,
	values: Partial<Pick<ReviewJobItemDocument, 'status'>> & { error?: string | null },
	status: ReviewJobItemDocument['status']
): Promise<ReviewJobItemDocument | null> {
	const [row] = await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({ ...values, updatedAt: new Date() })
		.where(
			and(
				eq(qualityReviewJobItems.questionId, questionId),
				eq(qualityReviewJobItems.status, status)
			)
		)
		.returning();
	return row ? itemFromRow(row as Record<string, unknown>) : null;
}

export async function createReviewJobItems(
	jobId: string,
	items: Array<Pick<ReviewJobItemDocument, 'questionId' | 'blind' | 'requiresWebSearch'>>
): Promise<void> {
	if (!items.length) return;
	await getNeonDatabase()
		.insert(qualityReviewJobItems)
		.values(
			items.map((item) => ({
				id: randomUUID(),
				jobId,
				questionId: item.questionId,
				status: 'queued',
				attempts: 0,
				blind: item.blind,
				requiresWebSearch: item.requiresWebSearch
			}))
		);
}
