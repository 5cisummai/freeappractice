import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import type {
	AiQualityAssessment,
	FeedbackSummary,
	FeedbackType,
	HumanQualityAssessment,
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
	state: 'unreviewed' | 'awaiting_human' | 'final';
	aiAssessment?: AiQualityAssessment;
	humanAssessment?: HumanQualityAssessment;
	finalVerdict?: QualityVerdict;
	finalSource?: 'ai' | 'human';
	finalizedAt?: Date;
	needsHumanReview: boolean;
	humanReviewReason?: string;
	blindHumanReview: boolean;
	feedbackSummary: FeedbackSummary;
	audit: Array<{
		at: Date;
		actorId: string;
		action: string;
		fromVerdict?: QualityVerdict;
		toVerdict?: QualityVerdict;
		note?: string;
	}>;
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
		feedbackSummary: summaryFromRow(row),
		audit: []
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

export const QuestionQuality = Object.assign(qualityBase, {
	collection: qualityBase,
	schema: qualitySchemaMetadata
});

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
export const QuestionFeedback = Object.assign(feedbackBase, {
	schema: {
		indexes: () =>
			[[{ questionId: 1, userId: 1, type: 1 }, { unique: true }]] as Array<
				[Record<string, unknown>, { unique?: boolean }]
			>
	}
});

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
	await jobBase.updateOne({ _id: document._id }, { $set: document }).exec();
	await db
		.delete(qualityReviewJobCandidates as any)
		.where(eq((qualityReviewJobCandidates as any).jobId, document._id));
	if (document.selectedQuestionIds.length) {
		await db.insert(qualityReviewJobCandidates as any).values(
			document.selectedQuestionIds.map((questionId, position) => ({
				jobId: document._id,
				questionId,
				position,
				selected: true
			}))
		);
	}
	await db
		.delete(qualityReviewBatches as any)
		.where(eq((qualityReviewBatches as any).jobId, document._id));
	if (document.batches.length) {
		await db
			.insert(qualityReviewBatches as any)
			.values(
				document.batches.map((batch) => ({ id: randomUUID(), jobId: document._id, ...batch }))
			);
	}
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
		const row = await jobBase.create(input);
		const db = getNeonDatabase() as any;
		const selectedQuestionIds = Array.isArray(input.selectedQuestionIds)
			? input.selectedQuestionIds
			: [];
		if (selectedQuestionIds.length) {
			await db.insert(qualityReviewJobCandidates as any).values(
				selectedQuestionIds.map((questionId: string, position: number) => ({
					jobId: row._id,
					questionId,
					position,
					selected: true
				}))
			);
		}
		if (Array.isArray(input.batches) && input.batches.length) {
			await db.insert(qualityReviewBatches as any).values(
				input.batches.map((batch: Record<string, unknown>) => ({
					id: randomUUID(),
					jobId: row._id,
					...batch
				}))
			);
		}
		return hydrateJob(row);
	},
	countDocuments(filter: Record<string, unknown> = {}): PostgresQuery<number> {
		return jobBase.countDocuments(filter);
	},
	findOneAndUpdate(
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
	},
	updateOne(
		filter: Record<string, unknown>,
		update: Record<string, any>,
		options: Record<string, any> = {}
	): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => {
			const before = await QuestionQualityReviewJob.findOne(filter).exec();
			const after = await QuestionQualityReviewJob.findOneAndUpdate(filter, update, options).exec();
			return {
				acknowledged: true,
				matchedCount: before ? 1 : 0,
				modifiedCount: after && before ? 1 : 0,
				deletedCount: 0,
				upsertedCount: !before && after ? 1 : 0,
				upsertedId: !before && after ? after._id : undefined
			};
		});
	},
	deleteMany(filter: Record<string, unknown>): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => jobBase.deleteMany(filter).exec());
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

export const QuestionQualityReviewJobItem = Object.assign(jobItemBase, {
	schema: {
		indexes: () =>
			[[{ questionId: 1 }, { unique: true }]] as Array<
				[Record<string, unknown>, { unique?: boolean }]
			>
	}
});
