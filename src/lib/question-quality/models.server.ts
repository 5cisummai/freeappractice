import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import type {
	AiQualityAssessment,
	FeedbackSummary,
	FeedbackType,
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
	questionFeedback,
	questionQuality
} from '$lib/server/neon/schema';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	applyProjection,
	model,
	PostgresQuery,
	type Projection,
	type SortSpec,
	type WriteResult
} from '$lib/server/neon/model';

type DocumentFields = { _id: string; save: () => Promise<unknown> };

export interface QuestionQualityDocument extends DocumentFields {
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

function summaryFromRow(row: Record<string, any>): FeedbackSummary {
	return {
		answerIncorrect: Number(row.answerIncorrectCount ?? 0),
		questionUnclear: Number(row.questionUnclearCount ?? 0),
		explanationUnclear: Number(row.explanationUnclearCount ?? 0),
		uniqueReporters: Number(row.uniqueReporters ?? 0),
		priority: row.feedbackPriority ?? 'none'
	};
}

const qualityBase = model<QuestionQualityDocument>({
	table: questionQuality as any,
	columns: questionQuality as any,
	idField: 'questionId',
	fieldAliases: {
		'feedbackSummary.answerIncorrect': 'answerIncorrectCount',
		'feedbackSummary.questionUnclear': 'questionUnclearCount',
		'feedbackSummary.explanationUnclear': 'explanationUnclearCount',
		'feedbackSummary.uniqueReporters': 'uniqueReporters',
		'feedbackSummary.priority': 'feedbackPriority'
	},
	fromRow: (row) => ({
		...(row as unknown as QuestionQualityDocument),
		feedbackSummary: summaryFromRow(row)
	}),
	prepareInsert: async (input) => ({
		...input,
		feedbackSummary: undefined,
		state: input.state ?? 'unreviewed',
		needsHumanReview: input.needsHumanReview ?? false,
		blindHumanReview: input.blindHumanReview ?? false,
		answerIncorrectCount:
			(input.feedbackSummary as Partial<FeedbackSummary> | undefined)?.answerIncorrect ??
			input.answerIncorrectCount ??
			0,
		questionUnclearCount:
			(input.feedbackSummary as Partial<FeedbackSummary> | undefined)?.questionUnclear ??
			input.questionUnclearCount ??
			0,
		explanationUnclearCount:
			(input.feedbackSummary as Partial<FeedbackSummary> | undefined)?.explanationUnclear ??
			input.explanationUnclearCount ??
			0,
		uniqueReporters:
			(input.feedbackSummary as Partial<FeedbackSummary> | undefined)?.uniqueReporters ??
			input.uniqueReporters ??
			0,
		feedbackPriority:
			(input.feedbackSummary as Partial<FeedbackSummary> | undefined)?.priority ??
			input.feedbackPriority ??
			'none'
	})
});

const qualitySchemaMetadata = {
	indexes: () =>
		[[{ questionId: 1 }, { unique: true }]] as Array<
			[Record<string, unknown>, { unique?: boolean }]
		>
};

export const QuestionQuality = {
	find: qualityBase.find.bind(qualityBase),
	findOne: qualityBase.findOne.bind(qualityBase),
	updateOne: qualityBase.updateOne.bind(qualityBase),
	schema: qualitySchemaMetadata
};

export interface QuestionFeedbackDocument extends DocumentFields {
	questionId: string;
	userId: string;
	type: FeedbackType;
	apClass?: string;
	unit?: string;
	createdAt: Date;
	updatedAt: Date;
}

const feedbackBase = model<QuestionFeedbackDocument>({
	table: questionFeedback as any,
	columns: questionFeedback as any,
	idField: 'id',
	prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
});
export const QuestionFeedback = {
	updateOne: feedbackBase.updateOne.bind(feedbackBase),
	deleteMany: feedbackBase.deleteMany.bind(feedbackBase),
	schema: {
		indexes: () =>
			[[{ questionId: 1, userId: 1, type: 1 }, { unique: true }]] as Array<
				[Record<string, unknown>, { unique?: boolean }]
			>
	}
};

export interface ReviewJobDocument extends DocumentFields {
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
	processingLeaseUntil?: Date;
	submissionLeaseUntil?: Date;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

const jobBase = model<ReviewJobDocument>({
	table: qualityReviewJobs as any,
	columns: qualityReviewJobs as any,
	idField: 'id',
	prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
});

function jobTableValues(input: Record<string, unknown>): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (key === '_id' || key === 'save' || key === 'then') continue;
		if (key in qualityReviewJobs && value !== undefined) values[key] = value;
	}
	return values;
}

function jobRowWithId(row: Record<string, unknown>): ReviewJobDocument {
	const id = row._id ?? row.id;
	if (!id) throw new Error('PostgreSQL insert returned no job id');
	return { ...row, _id: id, id } as ReviewJobDocument;
}

function candidateValues(jobId: string, selectedQuestionIds: string[]) {
	return selectedQuestionIds.map((questionId, position) => ({
		jobId,
		questionId,
		position,
		selected: true
	}));
}

function batchValues(jobId: string, batches: Array<Record<string, unknown>>) {
	return batches.map((batch) => ({ id: randomUUID(), jobId, ...batch }));
}

async function hydrateJob(row: ReviewJobDocument): Promise<ReviewJobDocument> {
	const db = getNeonDatabase() as any;
	const [candidates, batches] = await Promise.all([
		db
			.select()
			.from(qualityReviewJobCandidates as any)
			.where(eq((qualityReviewJobCandidates as any).jobId, row._id))
			.orderBy(asc((qualityReviewJobCandidates as any).position)),
		db
			.select()
			.from(qualityReviewBatches as any)
			.where(eq((qualityReviewBatches as any).jobId, row._id))
			.orderBy(asc((qualityReviewBatches as any).createdAt))
	]);
	const document: ReviewJobDocument = {
		...row,
		selectedQuestionIds: (candidates as Array<{ questionId: string; selected: boolean }>)
			.filter((item) => item.selected)
			.map((item) => item.questionId),
		batches: (batches as Array<Record<string, any>>).map((item) => ({
			submissionKey: item.submissionKey,
			inputFileId: item.inputFileId,
			batchId: item.batchId ?? undefined,
			status: item.status,
			outputFileId: item.outputFileId ?? undefined,
			errorFileId: item.errorFileId ?? undefined,
			createdAt: item.createdAt,
			completedAt: item.completedAt ?? undefined
		})),
		save: async () => document
	};
	document.save = async () => persistJobDocument(document);
	return document;
}

async function persistJobDocument(document: ReviewJobDocument): Promise<ReviewJobDocument> {
	const db = getNeonDatabase() as any;
	const jobId = document._id;
	const parentUpdate = db
		.update(qualityReviewJobs as any)
		.set({
			...jobTableValues(document as unknown as Record<string, unknown>),
			updatedAt: new Date()
		})
		.where(eq((qualityReviewJobs as any).id, jobId));
	const deleteCandidates = db
		.delete(qualityReviewJobCandidates as any)
		.where(eq((qualityReviewJobCandidates as any).jobId, jobId));
	const deleteBatches = db
		.delete(qualityReviewBatches as any)
		.where(eq((qualityReviewBatches as any).jobId, jobId));
	const queries: unknown[] = [parentUpdate, deleteCandidates];
	if (document.selectedQuestionIds.length) {
		queries.push(
			db
				.insert(qualityReviewJobCandidates as any)
				.values(candidateValues(jobId, document.selectedQuestionIds))
		);
	}
	queries.push(deleteBatches);
	if (document.batches.length) {
		queries.push(
			db
				.insert(qualityReviewBatches as any)
				.values(batchValues(jobId, document.batches as unknown as Array<Record<string, unknown>>))
		);
	}
	await db.batch(queries);
	return document;
}

function batchMatchesFilters(batch: Record<string, unknown>, filters: unknown): boolean {
	if (!Array.isArray(filters) || !filters.length) return true;
	const filter = filters[0];
	if (!filter || typeof filter !== 'object') return true;
	return Object.entries(filter as Record<string, unknown>).every(([key, value]) => {
		const field = key.replace(/^entry\./, '');
		return batch[field] === value;
	});
}

function findOneAndUpdateReviewJob(
	filter: Record<string, unknown>,
	update: Record<string, any>,
	options: Record<string, any> = {}
): PostgresQuery<ReviewJobDocument | null> {
	return new PostgresQuery(async () => {
		const current = await QuestionQualityReviewJob.findOne(filter).exec();
		if (!current) {
			if (!options.upsert) return null;
			const row = await jobBase.findOneAndUpdate(filter, update, options).exec();
			return row ? hydrateJob(row) : null;
		}
		const mutable = current as unknown as Record<string, any>;
		for (const [key, value] of Object.entries(update.$set ?? {})) {
			const nestedBatch = key.match(/^batches\.\$\[([^\]]+)\]\.(.+)$/);
			if (nestedBatch) {
				const filterIndex = Array.isArray(options.arrayFilters)
					? options.arrayFilters.findIndex((entry: Record<string, unknown>) =>
							Object.keys(entry).some((name) => name.startsWith(`${nestedBatch[1]}.`))
						)
					: -1;
				for (const batch of current.batches as unknown as Array<Record<string, unknown>>) {
					if (
						filterIndex === -1 ||
						batchMatchesFilters(batch, [options.arrayFilters[filterIndex]])
					) {
						batch[nestedBatch[2]] = value;
					}
				}
				continue;
			}
			mutable[key] = value;
		}
		for (const [key] of Object.entries(update.$unset ?? {})) mutable[key] = undefined;
		for (const [key, value] of Object.entries(update.$inc ?? {}))
			mutable[key] = Number(mutable[key] ?? 0) + Number(value);
		if (update.$push?.batches) current.batches.push(update.$push.batches);
		await persistJobDocument(current);
		return current;
	});
}

export const QuestionQualityReviewJob = {
	find(
		filter: Record<string, unknown> = {},
		projection?: Projection | null,
		options?: { sort?: SortSpec; limit?: number }
	): PostgresQuery<ReviewJobDocument[]> {
		return new PostgresQuery(async (queryOptions) => {
			const rows = await jobBase
				.find(filter, undefined, {
					sort: queryOptions.sort ?? options?.sort,
					limit: queryOptions.limit ?? options?.limit
				})
				.exec();
			const hydrated = await Promise.all(rows.map(hydrateJob));
			return hydrated.map((row) =>
				applyProjection(row, queryOptions.projection ?? projection ?? undefined)
			);
		});
	},
	findOne(
		filter: Record<string, unknown> = {},
		projection?: Projection | null
	): PostgresQuery<ReviewJobDocument | null> {
		return new PostgresQuery(async (queryOptions) => {
			const row = await jobBase.findOne(filter).exec();
			return row
				? applyProjection(await hydrateJob(row), queryOptions.projection ?? projection ?? undefined)
				: null;
		});
	},
	findById(id: string): PostgresQuery<ReviewJobDocument | null> {
		return this.findOne({ _id: id });
	},
	async create(input: Record<string, any>): Promise<ReviewJobDocument> {
		const db = getNeonDatabase() as any;
		const selectedQuestionIds = Array.isArray(input.selectedQuestionIds)
			? input.selectedQuestionIds
			: [];
		const batches = Array.isArray(input.batches) ? input.batches : [];
		const prepared = { ...input, id: input.id ?? randomUUID() };
		const parentInsert = db
			.insert(qualityReviewJobs as any)
			.values(jobTableValues(prepared))
			.returning();
		const queries: unknown[] = [parentInsert];
		if (selectedQuestionIds.length) {
			queries.push(
				db
					.insert(qualityReviewJobCandidates as any)
					.values(candidateValues(prepared.id, selectedQuestionIds))
			);
		}
		if (batches.length) {
			queries.push(
				db.insert(qualityReviewBatches as any).values(batchValues(prepared.id, batches))
			);
		}
		const [rows] = await db.batch(queries);
		const row = (rows as Array<Record<string, unknown>> | undefined)?.[0];
		if (!row) throw new Error('PostgreSQL insert returned no row');
		return hydrateJob(jobRowWithId(row));
	},
	updateOne(
		filter: Record<string, unknown>,
		update: Record<string, any>,
		options: Record<string, any> = {}
	): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => {
			const before = await QuestionQualityReviewJob.findOne(filter).exec();
			const after = await findOneAndUpdateReviewJob(filter, update, options).exec();
			return {
				acknowledged: true,
				matchedCount: before ? 1 : 0,
				modifiedCount: after && before ? 1 : 0,
				deletedCount: 0,
				upsertedCount: !before && after ? 1 : 0,
				upsertedId: !before && after ? after._id : undefined
			};
		});
	}
};

export interface ReviewJobItemDocument extends DocumentFields {
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

const jobItemBase = model<ReviewJobItemDocument>({
	table: qualityReviewJobItems as any,
	columns: qualityReviewJobItems as any,
	idField: 'id',
	prepareInsert: async (input) => ({
		...input,
		id: input.id ?? randomUUID(),
		attempts: input.attempts ?? 0,
		blind: input.blind ?? false,
		requiresWebSearch: input.requiresWebSearch ?? true
	})
});

export const QuestionQualityReviewJobItem = {
	find: jobItemBase.find.bind(jobItemBase),
	findOne: jobItemBase.findOne.bind(jobItemBase),
	updateOne: jobItemBase.updateOne.bind(jobItemBase),
	findOneAndUpdate: jobItemBase.findOneAndUpdate.bind(jobItemBase),
	schema: {
		indexes: () =>
			[[{ questionId: 1 }, { unique: true }]] as Array<
				[Record<string, unknown>, { unique?: boolean }]
			>
	}
};
