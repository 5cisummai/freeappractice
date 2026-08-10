import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	questionQualityAudits,
	qualityReviewJobItems,
	questionRegistry
} from '$lib/server/neon/schema';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
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
	createReviewJob as persistReviewJob,
	appendReviewJobBatch,
	clearReviewJobBatch,
	completeReviewJobBatch,
	getQuestionQuality,
	getReviewJob,
	getReviewJobItem,
	listActiveReviewJobIds,
	listAssessedQuestionIds,
	listClaimedReviewQuestionIds,
	listReviewJobItems,
	updateQuestionQuality,
	ensureQuestionQuality,
	updateReviewJob,
	updateReviewJobBatch,
	updateReviewJobItem,
	updateReviewJobItemByQuestion,
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
	const registryFilters = [
		or(
			lte(questionRegistry.questionCreatedAt, cutoff),
			and(isNull(questionRegistry.questionCreatedAt), lte(questionRegistry.createdAt, cutoff))
		)
	];
	if (normalized.apClass) registryFilters.push(eq(questionRegistry.apClass, normalized.apClass));
	if (normalized.unit) registryFilters.push(eq(questionRegistry.unit, normalized.unit));
	if (normalized.createdAfter || normalized.createdBefore) {
		const requestedEnd = normalized.createdBefore ? new Date(normalized.createdBefore) : cutoff;
		const end = requestedEnd < cutoff ? requestedEnd : cutoff;
		registryFilters.push(
			and(isNull(questionRegistry.questionCreatedAt), lte(questionRegistry.createdAt, end)),
			and(
				...(normalized.createdAfter
					? [gte(questionRegistry.questionCreatedAt, new Date(normalized.createdAfter))]
					: []),
				lte(questionRegistry.questionCreatedAt, end)
			)
		);
	}

	const candidates = await getNeonDatabase()
		.select({
			questionId: questionRegistry.questionId,
			contentLength: questionRegistry.contentLength
		})
		.from(questionRegistry)
		.where(and(...registryFilters))
		.orderBy(asc(questionRegistry.questionCreatedAt), asc(questionRegistry.createdAt))
		.limit(Math.min(50_000, normalized.maxCount * 20));
	const candidateIds = candidates.map((row) => row.questionId);
	const [assessed, claimed] = await Promise.all([
		listAssessedQuestionIds(candidateIds),
		listClaimedReviewQuestionIds(candidateIds)
	]);
	const excluded = new Set([...assessed, ...claimed]);
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
	const job = await persistReviewJob({
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
		previewId: job.id,
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
	await updateReviewJob(jobId, {
		queuedCount: (byStatus.queued ?? 0) + (byStatus.preparing ?? 0),
		submittedCount: byStatus.submitted ?? 0,
		awaitingHumanCount: byStatus.awaiting_human ?? 0,
		finalCount: byStatus.final ?? 0,
		failedCount: byStatus.failed ?? 0,
		actualCostUsd
	});
}

async function persistCreatedBatch(opts: {
	jobId: string;
	submissionKey: string;
	batch: { id: string; status: string };
}): Promise<boolean> {
	const latest = await getReviewJob(opts.jobId);
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
	await updateReviewJob(opts.jobId, { status: nextStatus }, { notStatus: 'cancelled' });
	await updateReviewJobBatch(opts.jobId, opts.submissionKey, opts.batch);
	await markPreparingItemsSubmitted(opts.jobId, opts.submissionKey, opts.batch.id);
	return true;
}

async function submitNextBatch(jobId: string): Promise<void> {
	const leaseUntil = await claimReviewSubmissionLease(jobId);
	if (!leaseUntil) return;
	const job = await getReviewJob(jobId);
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
				jobId: job.id,
				submissionKey: job.activeSubmissionKey,
				batch
			});
			await refreshJobCounts(job.id);
			return;
		}
		await requeueStalePreparingItems(job.id, new Date(Date.now() - 5 * 60_000));

		const items = await listReviewJobItems({ jobId: job.id, status: 'queued', limit: batchSize() });
		if (!items.length) {
			await refreshJobCounts(job.id);
			const [{ count: awaiting }] = await getNeonDatabase()
				.select({ count: sql<number>`count(*)::int` })
				.from(qualityReviewJobItems)
				.where(
					sql`${qualityReviewJobItems.jobId} = ${job.id} AND ${qualityReviewJobItems.status} = 'awaiting_human'`
				);
			await updateReviewJob(job.id, {
				status: transitionReviewJobStatus(job.status, awaiting ? 'await_human' : 'complete')
			});
			return;
		}

		const submissionKey = `${job.id}-${randomUUID()}`;
		const itemIds = items.map((item) => item.id);
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
				await updateReviewJobItem(item.id, { requiresWebSearch });
				const line = buildBatchLine({
					questionId: item.questionId,
					question: question as unknown as Record<string, unknown>,
					model: job.model,
					reasoningEffort: env.QUESTION_QUALITY_REASONING_EFFORT || 'medium'
				});
				const lineBytes = Buffer.byteLength(line) + 1;
				if (batchBytes + lineBytes > MAX_BATCH_FILE_BYTES) {
					const cannotFitAlone = lineBytes > MAX_BATCH_FILE_BYTES;
					await updateReviewJobItem(
						item.id,
						{
							status: cannotFitAlone
								? nextItemStatus('preparing', 'fail')
								: nextItemStatus('preparing', 'retry'),
							...(cannotFitAlone
								? { error: 'Question exceeds the Batch API file-size limit' }
								: {}),
							attempts: Math.max(0, item.attempts - 1)
						},
						{ status: 'preparing' }
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
				await updateReviewJobItem(item.id, {
					status: nextItemStatus('preparing', 'fail'),
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		if (!batchBytes) {
			return;
		}

		const inputFileId = await uploadBatchInput(input.toParts(), `question-quality-${job.id}.jsonl`);
		await appendReviewJobBatch(job.id, inputFileId, submissionKey);
		const batch = await createOpenAiBatch({ inputFileId, idempotencyKey: submissionKey });
		await persistCreatedBatch({ jobId: job.id, submissionKey, batch });
		await refreshJobCounts(job.id);
	} finally {
		await releaseReviewSubmissionLease(job.id, leaseUntil);
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
	const refreshed = await getReviewJob(activation.jobId);
	if (!refreshed) throw new Error('Review job disappeared after creation');
	return toJobSummary(refreshed);
}

async function updateQualityFromBatchLine(
	job: { id: string; model: string; calibrated: boolean },
	line: string
): Promise<void> {
	const parsed = JSON.parse(line) as {
		custom_id: string;
		response?: { status_code?: number; body?: unknown };
		error?: { message?: string } | null;
	};
	const questionId = parsed.custom_id;
	const item = await getReviewJobItem(job.id, questionId);
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
		await updateReviewJobItem(item.id, { status: item.status, error: item.error });
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
		const existing = await getQuestionQuality(questionId);
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
		const registryRows = await getNeonDatabase()
			.select({
				contentHash: questionRegistry.contentHash,
				s3Etag: questionRegistry.s3Etag,
				questionCreatedAt: questionRegistry.questionCreatedAt,
				apClass: questionRegistry.apClass,
				unit: questionRegistry.unit
			})
			.from(questionRegistry)
			.where(eq(questionRegistry.questionId, questionId))
			.limit(1);
		const registry = registryRows[0];
		const now = new Date();
		await ensureQuestionQuality(questionId);
		const qualityWrite = await updateQuestionQuality(
			questionId,
			{
				aiAssessment: assessment,
				sourceHash: registry?.contentHash ?? null,
				sourceEtag: registry?.s3Etag ?? null,
				sourceCreatedAt: registry?.questionCreatedAt ?? null,
				apClass: registry?.apClass ?? null,
				unit: registry?.unit ?? null,
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
			},
			{ requireUnassessed: true, ...(human.required ? {} : { requireHumanReview: false }) }
		);
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
			let persisted = await getQuestionQuality(questionId);
			if (persisted && !persisted.aiAssessment && persisted.needsHumanReview) {
				await updateQuestionQuality(
					questionId,
					{
						aiAssessment: assessment,
						state: transitionQualityState(persisted.state, 'assess_for_human')
					},
					{ requireUnassessed: true, requireHumanReview: true }
				);
				await appendQualityAudit({
					questionId,
					at: now,
					actorId: 'question-quality-agent',
					action: 'ai_assessed_for_human',
					note: persisted.humanReviewReason || 'student_feedback'
				});
				persisted = await getQuestionQuality(questionId);
			}
			item.status = nextItemStatus(
				item.status,
				persisted?.needsHumanReview ? 'await_human' : 'finalize'
			);
		}
		item.error = undefined;
		await updateReviewJobItem(item.id, { status: item.status, error: null });
	} catch (error) {
		await ensureQuestionQuality(questionId);
		await updateQuestionQuality(questionId, {
			state: transitionQualityState('unreviewed', 'assess_for_human'),
			needsHumanReview: true,
			humanReviewReason: 'schema_failure',
			blindHumanReview: false
		});
		item.status = nextItemStatus(item.status, 'await_human');
		item.error = error instanceof Error ? error.message : String(error);
		await updateReviewJobItem(item.id, { status: item.status, error: item.error });
	}
}

async function importBatch(job: ReviewJobDocument, outputFileId?: string): Promise<void> {
	if (outputFileId) {
		const stream = await downloadOpenAiFileStream(outputFileId);
		await forEachJsonlLine(stream, (line) => updateQualityFromBatchLine(job, line));
	}

	const unresolved = job.activeBatchId
		? await listReviewJobItems({ jobId: job.id, batchId: job.activeBatchId, status: 'submitted' })
		: [];
	for (const item of unresolved) {
		item.status = nextItemStatus(item.status, item.attempts < 3 ? 'retry' : 'fail');
		item.error = 'Batch completed without a result for this question';
		await updateReviewJobItem(item.id, { status: item.status, error: item.error });
	}
	await clearReviewJobBatch(job.id, outputFileId);
}

export async function refreshReviewJob(jobId: string): Promise<QualityJobSummary> {
	const leaseUntil = await claimReviewProcessingLease(jobId);
	if (!leaseUntil) {
		const existing = await getReviewJob(jobId);
		if (!existing) throw new Error('Review job not found');
		return toJobSummary(existing);
	}
	const job = await getReviewJob(jobId);
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
				await completeReviewJobBatch(
					job.id,
					batch.id,
					batch.status,
					batch.output_file_id,
					batch.error_file_id
				);
				await importBatch(job, batch.output_file_id);
			}
		}
		if (job.status !== 'paused' && job.status !== 'cancelled' && !job.activeBatchId) {
			await submitNextBatch(job.id);
		}
		await refreshJobCounts(job.id);
	} catch (error) {
		await updateReviewJob(job.id, {
			error: error instanceof Error ? error.message : String(error)
		});
		throw error;
	} finally {
		await releaseReviewProcessingLease(job.id, leaseUntil);
	}
	const refreshed = await getReviewJob(jobId);
	if (!refreshed) throw new Error('Review job not found after refresh');
	return toJobSummary(refreshed);
}

export async function setReviewJobState(
	jobId: string,
	action: 'pause' | 'resume' | 'cancel'
): Promise<QualityJobSummary> {
	const job = await getReviewJob(jobId);
	if (!job) throw new Error('Review job not found');
	if (action === 'pause') job.status = transitionReviewJobStatus(job.status, 'pause');
	if (action === 'resume') job.status = transitionReviewJobStatus(job.status, 'resume');
	if (action === 'cancel') {
		if (job.activeBatchId) {
			await cancelOpenAiBatch(job.activeBatchId);
			await failSubmittedBatchItems(job.id, job.activeBatchId, 'Cancelled by administrator');
		}
		await cancelPendingReviewItems(job.id, 'Cancelled by administrator');
		job.status = transitionReviewJobStatus(job.status, 'cancel');
	}
	await updateReviewJob(job.id, { status: job.status });
	if (action === 'resume') return refreshReviewJob(jobId);
	return toJobSummary(job);
}

export async function recoverActiveReviewJobs(): Promise<number> {
	const jobs = await listActiveReviewJobIds();
	for (const jobId of jobs) {
		try {
			await refreshReviewJob(jobId);
		} catch (error) {
			logger.error('Question quality recovery failed', {
				jobId,
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
	const existing = await getQuestionQuality(opts.questionId);
	const result = await updateQuestionQuality(opts.questionId, {
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
	});
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
	const item = await updateReviewJobItemByQuestion(
		opts.questionId,
		{ status: nextItemStatus('awaiting_human', 'finalize') },
		'awaiting_human'
	);
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
			const currentJob = await getReviewJob(item.jobId);
			if (!currentJob) return;
			await updateReviewJob(
				item.jobId,
				{ status: transitionReviewJobStatus(currentJob.status, 'complete') },
				{ status: currentJob.status }
			);
		}
	}
}
