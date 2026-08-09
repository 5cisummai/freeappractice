import { createHash, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	questionQualityAudits,
	qualityReviewJobItems,
	questionRegistry
} from '$lib/server/neon/schema';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { QuestionId } from '$lib/questions/question-id-model.server';
import { getAllQuestions, getQuestionById } from '$lib/questions/storage.server';
import { getCompletedReviewCost } from './cost.server.js';
import { isAgentCalibrated, modelName, toJobSummary } from './dashboard.server.js';
import {
	syncQuestionMetadata,
	updateQuestionRegistryMetadata,
	upsertQuestionInventory
} from './inventory-writes.server.js';
import { activateReviewJob } from './job-activation.server.js';
import {
	claimReviewProcessingLease,
	claimReviewSubmissionLease,
	releaseReviewProcessingLease,
	releaseReviewSubmissionLease
} from './leases.server.js';
import {
	QuestionQuality,
	QuestionQualityReviewJob,
	QuestionQualityReviewJobItem,
	type ReviewJobDocument
} from './models.server.js';
import {
	cancelOpenAiBatch,
	createOpenAiBatch,
	downloadOpenAiFileStream,
	buildBatchLine,
	retrieveOpenAiBatch,
	uploadBatchInput
} from './openai-batch.server.js';
import { forEachJsonlLine, JsonlChunkBuilder } from './jsonl.js';
import {
	cancelPendingReviewItems,
	claimQueuedReviewItems,
	failPreparingSubmissionItems,
	failSubmittedBatchItems,
	markPreparingItemsSubmitted,
	requeueStalePreparingItems
} from './review-item-writes.server.js';
import {
	extractResponseOutputText,
	extractWebSearchEvidence,
	parseAssessmentText,
	requiresWebSearchForQuestion
} from './rubric.server.js';
import { estimateCostUsd, feedbackSummaryFromCounts, shouldRequireHumanReview } from './rules.js';
import {
	QUESTION_QUALITY_RUBRIC_VERSION,
	type QualityJobSummary,
	type QualityVerdict,
	type ReviewFilters,
	type ReviewPreview
} from './types.js';
import {
	transitionReviewItemStatus,
	transitionReviewJobStatus,
	transitionQualityState,
	type ReviewItemStatus
} from './transitions.js';

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_BATCH_FILE_BYTES = 190 * 1024 * 1024;
const MAX_AUDIT_ENTRIES_PER_QUESTION = 100;

async function appendQualityAudit(input: {
	questionId: string;
	at: Date;
	actorId: string;
	action: string;
	fromVerdict?: QualityVerdict;
	toVerdict?: QualityVerdict;
	note?: string;
}): Promise<void> {
	const db = getNeonDatabase() as any;
	const auditId = randomUUID();
	const insert = db.insert(questionQualityAudits as any).values({
		id: auditId,
		questionId: input.questionId,
		at: input.at,
		actorId: input.actorId,
		action: input.action,
		fromVerdict: input.fromVerdict,
		toVerdict: input.toVerdict,
		note: input.note
	});
	const trim = db.execute(sql`
		DELETE FROM content.question_quality_audits
		WHERE question_id = ${input.questionId}
		  AND id NOT IN (
			SELECT id
			FROM content.question_quality_audits
			WHERE question_id = ${input.questionId}
			ORDER BY at DESC, id DESC
			LIMIT ${MAX_AUDIT_ENTRIES_PER_QUESTION}
		)
	`);
	await db.batch([insert, trim]);
}

function nextItemStatus(
	current: string,
	transition: Parameters<typeof transitionReviewItemStatus>[1]
): ReviewItemStatus {
	return transitionReviewItemStatus(current as ReviewItemStatus, transition);
}

function confidenceThreshold(): number {
	const value = Number(env.QUESTION_QUALITY_CONFIDENCE_THRESHOLD || '0.85');
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.85;
}

function batchSize(): number {
	const value = Number.parseInt(env.QUESTION_QUALITY_BATCH_SIZE || '100', 10);
	const configured = Number.isFinite(value) ? Math.min(1_000, Math.max(1, value)) : 100;
	const queuedTokenCeiling = Number.parseInt(
		env.QUESTION_QUALITY_MAX_QUEUED_TOKENS || '250000',
		10
	);
	const tokenLimited = Math.max(1, Math.floor(queuedTokenCeiling / 2_500));
	return Math.min(configured, tokenLimited);
}

function inputPrice(): number {
	return Number(env.QUESTION_QUALITY_BATCH_INPUT_USD_PER_MILLION || '0.625');
}

function outputPrice(): number {
	return Number(env.QUESTION_QUALITY_BATCH_OUTPUT_USD_PER_MILLION || '3.75');
}

function maxOutputTokens(): number {
	const value = Number.parseInt(env.QUESTION_QUALITY_MAX_OUTPUT_TOKENS || '800', 10);
	return Number.isFinite(value) ? Math.max(100, value) : 800;
}

function normalizeFilters(
	filters: ReviewFilters
): Required<Pick<ReviewFilters, 'minimumAgeDays' | 'maxCount'>> & ReviewFilters {
	const minimumAgeDays = Number.isFinite(filters.minimumAgeDays)
		? Math.max(0, Number(filters.minimumAgeDays))
		: 7;
	const maxCount = Number.isFinite(filters.maxCount)
		? Math.min(10_000, Math.max(1, Math.floor(Number(filters.maxCount))))
		: 500;
	return {
		...filters,
		apClass: filters.apClass?.trim() || undefined,
		unit: filters.unit?.trim() || undefined,
		minimumAgeDays,
		maxCount
	};
}

export async function reconcileQuestionInventory(
	opts: { hydrateMetadata?: boolean } = { hydrateMetadata: false }
): Promise<{
	discovered: number;
	hydrated: number;
}> {
	const questions = await getAllQuestions();
	const questionsById = new Map(questions.map((question) => [question.id, question]));
	const objects = questions.map((question) => ({
		questionId: question.id,
		lastModified: new Date(question.createdAt),
		size: JSON.stringify(question).length
	}));
	if (objects.length) {
		await upsertQuestionInventory(
			objects.map((object) => ({
				questionId: object.questionId,
				questionCreatedAt: object.lastModified,
				contentLength: object.size
			}))
		);
	}

	let hydrated = 0;
	if (opts.hydrateMetadata) {
		for (let i = 0; i < objects.length; i += 10) {
			const group = objects.slice(i, i + 10);
			const rows = await Promise.all(
				group.map(async (object) => {
					try {
						const question = questionsById.get(object.questionId);
						if (!question) throw new Error('Question row was not found');
						const serialized = JSON.stringify(question);
						return {
							questionId: object.questionId,
							apClass: typeof question.apClass === 'string' ? question.apClass : undefined,
							unit: typeof question.unit === 'string' ? question.unit : undefined,
							questionCreatedAt: question.createdAt
								? new Date(question.createdAt)
								: object.lastModified,
							contentHash:
								question.contentHash ?? createHash('sha256').update(serialized).digest('hex'),
							contentLength: serialized.length
						};
					} catch (error) {
						logger.warn('Unable to hydrate question registry metadata', {
							questionId: object.questionId,
							error: error instanceof Error ? error.message : String(error)
						});
						return null;
					}
				})
			);
			const valid = rows.filter((row): row is NonNullable<typeof row> => row !== null);
			if (valid.length) {
				// Legacy S3 source hashes are not comparable to the Neon row hash. Refresh
				// the baseline without invalidating existing quality decisions.
				await syncQuestionMetadata(valid);
				hydrated += valid.length;
			}
		}
	}

	return { discovered: objects.length, hydrated };
}

export async function previewReviewJob(
	filters: ReviewFilters,
	actorId = 'admin'
): Promise<ReviewPreview> {
	const normalized = normalizeFilters(filters);
	if (normalized.qualityState && normalized.qualityState !== 'unreviewed') {
		throw new Error(
			'V1 review runs only accept unreviewed questions to prevent duplicate labeling'
		);
	}
	if (normalized.apClass || normalized.unit) {
		const db = getNeonDatabase();
		const [{ count: unsynced }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(questionRegistry)
			.where(sql`${questionRegistry.metadataSyncedAt} IS NULL`);
		if (unsynced) {
			throw new Error(`Question metadata is not synchronized (${unsynced} unsynced)`);
		}
	}

	const cutoff = new Date(Date.now() - normalized.minimumAgeDays * 86_400_000);
	const registryQuery: Record<string, unknown> = {
		$or: [
			{ questionCreatedAt: { $lte: cutoff } },
			{ questionCreatedAt: { $exists: false }, createdAt: { $lte: cutoff } }
		]
	};
	if (normalized.apClass) registryQuery.apClass = normalized.apClass;
	if (normalized.unit) registryQuery.unit = normalized.unit;
	if (normalized.createdAfter || normalized.createdBefore) {
		const requestedEnd = normalized.createdBefore ? new Date(normalized.createdBefore) : cutoff;
		const end = requestedEnd < cutoff ? requestedEnd : cutoff;
		registryQuery.questionCreatedAt = {
			...(normalized.createdAfter ? { $gte: new Date(normalized.createdAfter) } : {}),
			$lte: end
		};
	}

	const candidates = await QuestionId.find(registryQuery)
		.sort({ questionCreatedAt: 1, createdAt: 1 })
		.limit(Math.min(50_000, normalized.maxCount * 20))
		.select({ questionId: 1, contentLength: 1 })
		.lean()
		.exec();
	const candidateIds = candidates.map((row) => row.questionId);
	const [assessed, claimed] = await Promise.all([
		QuestionQuality.find({ questionId: { $in: candidateIds }, aiAssessment: { $exists: true } })
			.select({ questionId: 1 })
			.lean()
			.exec(),
		QuestionQualityReviewJobItem.find({
			questionId: { $in: candidateIds },
			status: { $ne: 'failed' }
		})
			.select({ questionId: 1 })
			.lean()
			.exec()
	]);
	const excluded = new Set([...assessed, ...claimed].map((row) => row.questionId));
	const selectedQuestionIds = candidateIds
		.filter((questionId) => !excluded.has(questionId))
		.slice(0, normalized.maxCount);
	const contentLengths = new Map(candidates.map((row) => [row.questionId, row.contentLength]));
	const estimatedInputTokens = selectedQuestionIds.reduce(
		(total, questionId) => total + Math.ceil((contentLengths.get(questionId) ?? 7_500) / 3) + 1_500,
		0
	);
	const estimatedOutputTokens = selectedQuestionIds.length * maxOutputTokens();
	const estimate = {
		estimatedInputTokens,
		estimatedOutputTokens,
		estimatedMaximumCostUsd: estimateCostUsd(
			estimatedInputTokens,
			estimatedOutputTokens,
			inputPrice(),
			outputPrice()
		)
	};
	const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
	const job = await QuestionQualityReviewJob.create({
		status: 'preview',
		filters: normalized,
		selectedQuestionIds,
		selectedCount: selectedQuestionIds.length,
		skippedCount: excluded.size,
		queuedCount: selectedQuestionIds.length,
		...estimate,
		actualCostUsd: 0,
		model: modelName(),
		rubricVersion: QUESTION_QUALITY_RUBRIC_VERSION,
		calibrated: isAgentCalibrated(),
		createdBy: actorId,
		expiresAt
	});

	return {
		previewId: String(job._id),
		filters: normalized,
		selectedCount: selectedQuestionIds.length,
		skippedCount: excluded.size,
		...estimate,
		model: job.model,
		calibrated: job.calibrated,
		expiresAt
	};
}

async function refreshJobCounts(jobId: string): Promise<void> {
	const db = getNeonDatabase();
	const [counts, actualCostUsd] = await Promise.all([
		db
			.select({ status: qualityReviewJobItems.status, count: sql<number>`count(*)::int` })
			.from(qualityReviewJobItems)
			.where(eq(qualityReviewJobItems.jobId, String(jobId)))
			.groupBy(qualityReviewJobItems.status),
		getCompletedReviewCost(jobId)
	]);
	const byStatus = Object.fromEntries(
		counts.map((row: { status: string; count: number }) => [row.status, row.count])
	);
	await QuestionQualityReviewJob.updateOne(
		{ _id: jobId },
		{
			$set: {
				queuedCount: (byStatus.queued ?? 0) + (byStatus.preparing ?? 0),
				submittedCount: byStatus.submitted ?? 0,
				awaitingHumanCount: byStatus.awaiting_human ?? 0,
				finalCount: byStatus.final ?? 0,
				failedCount: byStatus.failed ?? 0,
				actualCostUsd
			}
		}
	);
}

async function persistCreatedBatch(opts: {
	jobId: string;
	submissionKey: string;
	batch: { id: string; status: string };
}): Promise<boolean> {
	const latest = await QuestionQualityReviewJob.findById(opts.jobId).lean().exec();
	if (!latest || latest.status === 'cancelled') {
		await cancelOpenAiBatch(opts.batch.id).catch(() => undefined);
		await failPreparingSubmissionItems(
			opts.jobId,
			opts.submissionKey,
			'Cancelled by administrator during submission'
		);
		return false;
	}
	const nextStatus =
		latest.status === 'paused'
			? 'paused'
			: latest.status === 'preparing'
				? transitionReviewJobStatus(latest.status, 'start')
				: latest.status;
	await Promise.all([
		QuestionQualityReviewJob.updateOne(
			{ _id: opts.jobId, status: { $ne: 'cancelled' } },
			{
				$set: {
					status: nextStatus,
					activeBatchId: opts.batch.id,
					'batches.$[entry].batchId': opts.batch.id,
					'batches.$[entry].status': opts.batch.status
				}
			},
			{ arrayFilters: [{ 'entry.submissionKey': opts.submissionKey }] }
		),
		markPreparingItemsSubmitted(opts.jobId, opts.submissionKey, opts.batch.id)
	]);
	return true;
}

async function submitNextBatch(jobId: string): Promise<void> {
	const leaseUntil = await claimReviewSubmissionLease(jobId);
	if (!leaseUntil) return;
	const job = await QuestionQualityReviewJob.findById(jobId).exec();
	if (!job) {
		await releaseReviewSubmissionLease(jobId, leaseUntil);
		return;
	}
	try {
		if (job.activeInputFileId && job.activeSubmissionKey) {
			const batch = await createOpenAiBatch({
				inputFileId: job.activeInputFileId,
				idempotencyKey: job.activeSubmissionKey
			});
			await persistCreatedBatch({
				jobId: job._id,
				submissionKey: job.activeSubmissionKey,
				batch
			});
			await refreshJobCounts(job._id);
			return;
		}
		await requeueStalePreparingItems(job._id, new Date(Date.now() - 5 * 60_000));

		const items = await QuestionQualityReviewJobItem.find({ jobId: job._id, status: 'queued' })
			.sort({ createdAt: 1 })
			.limit(batchSize())
			.exec();
		if (!items.length) {
			await refreshJobCounts(job._id);
			const [{ count: awaiting }] = await getNeonDatabase()
				.select({ count: sql<number>`count(*)::int` })
				.from(qualityReviewJobItems)
				.where(
					sql`${qualityReviewJobItems.jobId} = ${job._id} AND ${qualityReviewJobItems.status} = 'awaiting_human'`
				);
			await QuestionQualityReviewJob.updateOne(
				{ _id: job._id },
				{
					$set: {
						status: transitionReviewJobStatus(job.status, awaiting ? 'await_human' : 'complete')
					}
				}
			);
			return;
		}

		const submissionKey = `${job.id}-${randomUUID()}`;
		const itemIds = items.map((item) => item._id);
		const claimedItems = await claimQueuedReviewItems(itemIds, submissionKey);
		if (!claimedItems.length) return;

		const input = new JsonlChunkBuilder();
		let batchBytes = 0;
		for (const item of claimedItems) {
			try {
				const question = await getQuestionById(item.questionId);
				const requiresWebSearch = requiresWebSearchForQuestion(
					question as unknown as Record<string, unknown>
				);
				await QuestionQualityReviewJobItem.updateOne(
					{ _id: item.id },
					{ $set: { requiresWebSearch } }
				);
				const line = buildBatchLine({
					questionId: item.questionId,
					question: question as unknown as Record<string, unknown>,
					model: job.model,
					reasoningEffort: env.QUESTION_QUALITY_REASONING_EFFORT || 'medium'
				});
				const lineBytes = Buffer.byteLength(line) + 1;
				if (batchBytes + lineBytes > MAX_BATCH_FILE_BYTES) {
					const cannotFitAlone = lineBytes > MAX_BATCH_FILE_BYTES;
					await QuestionQualityReviewJobItem.updateOne(
						{ _id: item.id, status: 'preparing' },
						{
							$set: {
								status: cannotFitAlone
									? nextItemStatus('preparing', 'fail')
									: nextItemStatus('preparing', 'retry'),
								...(cannotFitAlone
									? { error: 'Question exceeds the Batch API file-size limit' }
									: {})
							},
							$inc: { attempts: -1 }
						}
					);
					continue;
				}
				input.add(line);
				batchBytes += lineBytes;
				const serialized = JSON.stringify(question);
				await updateQuestionRegistryMetadata({
					questionId: item.questionId,
					apClass: question.apClass,
					unit: question.unit,
					questionCreatedAt: question.createdAt ? new Date(question.createdAt) : undefined,
					contentHash: createHash('sha256').update(serialized).digest('hex'),
					contentLength: serialized.length
				});
			} catch (error) {
				await QuestionQualityReviewJobItem.updateOne(
					{ _id: item.id },
					{
						$set: {
							status: nextItemStatus('preparing', 'fail'),
							error: error instanceof Error ? error.message : String(error)
						}
					}
				);
			}
		}
		if (!batchBytes) {
			return;
		}

		const inputFileId = await uploadBatchInput(input.toParts(), `question-quality-${job.id}.jsonl`);
		await QuestionQualityReviewJob.updateOne(
			{ _id: job._id },
			{
				$set: { activeInputFileId: inputFileId, activeSubmissionKey: submissionKey },
				$push: {
					batches: {
						submissionKey,
						inputFileId,
						status: 'uploaded',
						createdAt: new Date()
					}
				}
			}
		);
		const batch = await createOpenAiBatch({ inputFileId, idempotencyKey: submissionKey });
		await persistCreatedBatch({ jobId: job._id, submissionKey, batch });
		await refreshJobCounts(job._id);
	} finally {
		await releaseReviewSubmissionLease(job._id, leaseUntil);
	}
}

export async function createReviewJob(
	previewId: string,
	actorId = 'admin'
): Promise<QualityJobSummary> {
	const activation = await activateReviewJob(previewId, actorId);
	if (!activation)
		throw new Error('Preview is missing, expired, already used, or belongs to another admin');

	await submitNextBatch(activation.jobId);
	const refreshed = await QuestionQualityReviewJob.findById(activation.jobId).lean().exec();
	if (!refreshed) throw new Error('Review job disappeared after creation');
	return toJobSummary(refreshed);
}

async function updateQualityFromBatchLine(
	job: { _id: string; model: string; calibrated: boolean },
	line: string
): Promise<void> {
	const parsed = JSON.parse(line) as {
		custom_id: string;
		response?: { status_code?: number; body?: unknown };
		error?: { message?: string } | null;
	};
	const questionId = parsed.custom_id;
	const item = await QuestionQualityReviewJobItem.findOne({ jobId: job._id, questionId }).exec();
	if (!item || item.status !== 'submitted') return;

	if (parsed.error || !parsed.response?.body || parsed.response.status_code !== 200) {
		if (item.attempts < 3) {
			item.status = nextItemStatus(item.status, 'retry');
			item.error =
				parsed.error?.message ||
				`OpenAI response status ${parsed.response?.status_code ?? 'unknown'}`;
		} else {
			item.status = nextItemStatus(item.status, 'fail');
			item.error = parsed.error?.message || 'OpenAI request failed after three attempts';
		}
		await item.save();
		return;
	}

	const body = parsed.response.body as {
		model?: string;
		usage?: { input_tokens?: number; output_tokens?: number };
		output?: unknown[];
	};
	const inputTokens = body.usage?.input_tokens ?? 0;
	const outputTokens = body.usage?.output_tokens ?? 0;
	try {
		const webEvidence = extractWebSearchEvidence(body);
		const assessment = parseAssessmentText(extractResponseOutputText(body), {
			model: body.model || job.model,
			inputTokens,
			outputTokens,
			estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens, inputPrice(), outputPrice()),
			...webEvidence
		});
		const existing = await QuestionQuality.findOne({ questionId }).lean().exec();
		const feedback = existing?.feedbackSummary ?? feedbackSummaryFromCounts({});
		const human = shouldRequireHumanReview({
			assessment,
			feedback,
			calibrated: job.calibrated,
			confidenceThreshold: confidenceThreshold(),
			calibrationSample: item.blind,
			webSearchRequired: item.requiresWebSearch !== false,
			webSearchUsed: assessment.webSearchUsed,
			sourceUrls: assessment.sourceUrls
		});
		const registry = await QuestionId.findOne({ questionId }).lean().exec();
		const now = new Date();
		await QuestionQuality.updateOne(
			{ questionId },
			{ $setOnInsert: { questionId, state: 'unreviewed' } },
			{ upsert: true }
		);
		const assessmentFilter: Record<string, unknown> = {
			questionId,
			aiAssessment: { $exists: false },
			...(!human.required ? { needsHumanReview: { $ne: true } } : {})
		};
		const qualityWrite = await QuestionQuality.updateOne(assessmentFilter, {
			$set: {
				aiAssessment: assessment,
				sourceHash: registry?.contentHash,
				sourceEtag: registry?.s3Etag,
				sourceCreatedAt: registry?.questionCreatedAt,
				apClass: registry?.apClass,
				unit: registry?.unit,
				state: transitionQualityState(
					existing?.state ?? 'unreviewed',
					human.required ? 'assess_for_human' : 'finalize'
				),
				needsHumanReview: human.required,
				humanReviewReason: human.required ? human.reason : undefined,
				blindHumanReview: human.required && item.blind,
				...(!human.required
					? {
							finalVerdict: assessment.verdict,
							finalSource: 'ai',
							finalizedAt: now
						}
					: {})
			}
		});
		if (qualityWrite.modifiedCount) {
			await appendQualityAudit({
				questionId,
				at: now,
				actorId: 'question-quality-agent',
				action: human.required ? 'ai_assessed_for_human' : 'ai_finalized',
				...(!human.required ? { toVerdict: assessment.verdict } : {}),
				note: human.reason
			});
			item.status = nextItemStatus(item.status, human.required ? 'await_human' : 'finalize');
		} else {
			let persisted = await QuestionQuality.findOne({ questionId }).lean().exec();
			if (persisted && !persisted.aiAssessment && persisted.needsHumanReview) {
				await QuestionQuality.updateOne(
					{ questionId, aiAssessment: { $exists: false }, needsHumanReview: true },
					{
						$set: {
							aiAssessment: assessment,
							state: transitionQualityState(persisted.state, 'assess_for_human')
						}
					}
				);
				await appendQualityAudit({
					questionId,
					at: now,
					actorId: 'question-quality-agent',
					action: 'ai_assessed_for_human',
					note: persisted.humanReviewReason || 'student_feedback'
				});
				persisted = await QuestionQuality.findOne({ questionId }).lean().exec();
			}
			item.status = nextItemStatus(
				item.status,
				persisted?.needsHumanReview ? 'await_human' : 'finalize'
			);
		}
		item.error = undefined;
		await item.save();
	} catch (error) {
		await QuestionQuality.updateOne(
			{ questionId },
			{
				$setOnInsert: { questionId },
				$set: {
					state: transitionQualityState('unreviewed', 'assess_for_human'),
					needsHumanReview: true,
					humanReviewReason: 'schema_failure',
					blindHumanReview: false
				}
			},
			{ upsert: true }
		);
		item.status = nextItemStatus(item.status, 'await_human');
		item.error = error instanceof Error ? error.message : String(error);
		await item.save();
	}
}

async function importBatch(job: ReviewJobDocument, outputFileId?: string): Promise<void> {
	if (outputFileId) {
		const stream = await downloadOpenAiFileStream(outputFileId);
		await forEachJsonlLine(stream, (line) => updateQualityFromBatchLine(job, line));
	}

	const unresolved = await QuestionQualityReviewJobItem.find({
		jobId: job._id,
		batchId: job.activeBatchId,
		status: 'submitted'
	}).exec();
	for (const item of unresolved) {
		item.status = nextItemStatus(item.status, item.attempts < 3 ? 'retry' : 'fail');
		item.error = 'Batch completed without a result for this question';
		await item.save();
	}
	job.activeBatchId = undefined;
	job.activeInputFileId = undefined;
	job.activeOutputFileId = outputFileId;
	job.activeSubmissionKey = undefined;
	await job.save();
}

export async function refreshReviewJob(jobId: string): Promise<QualityJobSummary> {
	const leaseUntil = await claimReviewProcessingLease(jobId);
	if (!leaseUntil) {
		const existing = await QuestionQualityReviewJob.findById(jobId).lean().exec();
		if (!existing) throw new Error('Review job not found');
		return toJobSummary(existing);
	}
	const job = await QuestionQualityReviewJob.findById(jobId).exec();
	if (!job) {
		await releaseReviewProcessingLease(jobId, leaseUntil);
		throw new Error('Review job not found after claiming its processing lease');
	}

	try {
		if (job.activeBatchId) {
			const batch = await retrieveOpenAiBatch(job.activeBatchId);
			if (
				batch.status === 'completed' ||
				batch.status === 'expired' ||
				batch.status === 'failed' ||
				batch.status === 'cancelled'
			) {
				await QuestionQualityReviewJob.updateOne(
					{ _id: job._id },
					{
						$set: {
							'batches.$[entry].status': batch.status,
							'batches.$[entry].outputFileId': batch.output_file_id,
							'batches.$[entry].errorFileId': batch.error_file_id,
							'batches.$[entry].completedAt': new Date()
						}
					},
					{ arrayFilters: [{ 'entry.batchId': batch.id }] }
				);
				await importBatch(job, batch.output_file_id);
			}
		}
		if (job.status !== 'paused' && job.status !== 'cancelled' && !job.activeBatchId) {
			await submitNextBatch(job.id);
		}
		await refreshJobCounts(job._id);
	} catch (error) {
		job.error = error instanceof Error ? error.message : String(error);
		await job.save();
		throw error;
	} finally {
		await releaseReviewProcessingLease(job._id, leaseUntil);
	}
	const refreshed = await QuestionQualityReviewJob.findById(jobId).lean().exec();
	if (!refreshed) throw new Error('Review job not found after refresh');
	return toJobSummary(refreshed);
}

export async function setReviewJobState(
	jobId: string,
	action: 'pause' | 'resume' | 'cancel'
): Promise<QualityJobSummary> {
	const job = await QuestionQualityReviewJob.findById(jobId).exec();
	if (!job) throw new Error('Review job not found');
	if (action === 'pause') job.status = transitionReviewJobStatus(job.status, 'pause');
	if (action === 'resume') job.status = transitionReviewJobStatus(job.status, 'resume');
	if (action === 'cancel') {
		if (job.activeBatchId) {
			await cancelOpenAiBatch(job.activeBatchId);
			await failSubmittedBatchItems(job._id, job.activeBatchId, 'Cancelled by administrator');
		}
		await cancelPendingReviewItems(job._id, 'Cancelled by administrator');
		job.status = transitionReviewJobStatus(job.status, 'cancel');
	}
	await job.save();
	if (action === 'resume') return refreshReviewJob(jobId);
	return toJobSummary(job);
}

export async function recoverActiveReviewJobs(): Promise<number> {
	const jobs = await QuestionQualityReviewJob.find({
		status: { $in: ['preparing', 'in_progress'] }
	})
		.sort({ updatedAt: 1 })
		.limit(5)
		.select({ _id: 1 })
		.lean()
		.exec();
	for (const job of jobs) {
		try {
			await refreshReviewJob(String(job._id));
		} catch (error) {
			logger.error('Question quality recovery failed', {
				jobId: String(job._id),
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	return jobs.length;
}

export async function recordHumanDecision(opts: {
	questionId: string;
	verdict: QualityVerdict;
	notes: string;
	reviewerId: string;
}): Promise<void> {
	const now = new Date();
	const existing = await QuestionQuality.findOne({ questionId: opts.questionId }).exec();
	const result = await QuestionQuality.updateOne(
		{ questionId: opts.questionId },
		{
			$set: {
				humanAssessment: {
					verdict: opts.verdict,
					notes: opts.notes,
					reviewerId: opts.reviewerId,
					blind: existing?.blindHumanReview ?? false,
					reviewedAt: now
				},
				finalVerdict: opts.verdict,
				finalSource: 'human',
				finalizedAt: now,
				state: transitionQualityState(existing?.state ?? 'awaiting_human', 'finalize'),
				needsHumanReview: false,
				blindHumanReview: false
			}
		}
	);
	if (!result.matchedCount) throw new Error('Question quality record not found');
	await appendQualityAudit({
		questionId: opts.questionId,
		at: now,
		actorId: opts.reviewerId,
		action: 'human_decision',
		fromVerdict: existing?.finalVerdict,
		toVerdict: opts.verdict,
		note: opts.notes
	});
	const item = await QuestionQualityReviewJobItem.findOneAndUpdate(
		{ questionId: opts.questionId, status: 'awaiting_human' },
		{ $set: { status: nextItemStatus('awaiting_human', 'finalize') } },
		{ new: true }
	).lean();
	if (item) {
		await refreshJobCounts(item.jobId);
		const [{ awaiting, active }] = await getNeonDatabase()
			.select({
				awaiting: sql<number>`count(*) filter (where ${qualityReviewJobItems.status} = 'awaiting_human')::int`,
				active: sql<number>`count(*) filter (where ${qualityReviewJobItems.status} in ('queued', 'preparing', 'submitted'))::int`
			})
			.from(qualityReviewJobItems)
			.where(eq(qualityReviewJobItems.jobId, item.jobId));
		if (!awaiting && !active) {
			const currentJob = await QuestionQualityReviewJob.findById(item.jobId).exec();
			if (!currentJob) return;
			await QuestionQualityReviewJob.updateOne(
				{ _id: item.jobId, status: currentJob.status },
				{ $set: { status: transitionReviewJobStatus(currentJob.status, 'complete') } }
			);
		}
	}
}
