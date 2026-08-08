import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '$env/dynamic/private';
import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { QuestionId } from '$lib/questions/question-id-model.server';
import { getQuestionFromS3 } from '$lib/questions/storage.server';
import { listQuestionObjects } from '$lib/questions/s3.server';
import { isAgentCalibrated, modelName, toJobSummary } from './dashboard.server.js';
import {
	QuestionQuality,
	QuestionQualityReviewJob,
	QuestionQualityReviewJobItem,
	type ReviewJobDocument
} from './models.server.js';
import {
	cancelOpenAiBatch,
	createOpenAiBatch,
	downloadOpenAiFile,
	buildBatchLine,
	retrieveOpenAiBatch,
	uploadBatchInput
} from './openai-batch.server.js';
import {
	extractResponseOutputText,
	extractWebSearchEvidence,
	parseAssessmentText,
	requiresWebSearchForQuestion
} from './rubric.server.js';
import {
	estimateCostUsd,
	feedbackSummaryFromCounts,
	isCalibrationSample,
	shouldRequireHumanReview
} from './rules.js';
import {
	QUESTION_QUALITY_RUBRIC_VERSION,
	type QualityJobSummary,
	type QualityVerdict,
	type ReviewFilters,
	type ReviewPreview
} from './types.js';

const ACTIVE_JOB_STATUSES = ['preparing', 'in_progress', 'paused'] as const;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_BATCH_FILE_BYTES = 190 * 1024 * 1024;

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
	opts: { hydrateMetadata?: boolean } = {}
): Promise<{
	discovered: number;
	hydrated: number;
}> {
	await connectDb();
	const objects = await listQuestionObjects();
	if (objects.length) {
		await QuestionId.bulkWrite(
			objects.map((object) => ({
				updateOne: {
					filter: { questionId: object.questionId },
					update: {
						$setOnInsert: { questionId: object.questionId },
						$set: {
							...(object.etag ? { s3Etag: object.etag } : {}),
							...(object.lastModified ? { questionCreatedAt: object.lastModified } : {}),
							...(typeof object.size === 'number' ? { contentLength: object.size } : {})
						}
					},
					upsert: true
				}
			})),
			{ ordered: false }
		);
	}

	let hydrated = 0;
	if (opts.hydrateMetadata) {
		for (let i = 0; i < objects.length; i += 10) {
			const group = objects.slice(i, i + 10);
			const rows = await Promise.all(
				group.map(async (object) => {
					try {
						const question = await getQuestionFromS3(object.questionId);
						const serialized = JSON.stringify(question);
						return {
							questionId: object.questionId,
							apClass: typeof question.apClass === 'string' ? question.apClass : undefined,
							unit: typeof question.unit === 'string' ? question.unit : undefined,
							questionCreatedAt: question.createdAt
								? new Date(question.createdAt)
								: object.lastModified,
							contentHash: createHash('sha256').update(serialized).digest('hex'),
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
				await QuestionId.bulkWrite(
					valid.map((row) => ({
						updateOne: {
							filter: { questionId: row.questionId },
							update: { $set: { ...row, metadataSyncedAt: new Date() } }
						}
					})),
					{ ordered: false }
				);
				await QuestionQuality.bulkWrite(
					valid.map((row) => ({
						updateOne: {
							filter: {
								questionId: row.questionId,
								sourceHash: { $exists: true, $ne: row.contentHash }
							},
							update: {
								$set: {
									sourceHash: row.contentHash,
									sourceCreatedAt: row.questionCreatedAt,
									state: 'awaiting_human',
									needsHumanReview: true,
									humanReviewReason: 'source_changed',
									blindHumanReview: false
								},
								$unset: {
									aiAssessment: 1,
									finalVerdict: 1,
									finalSource: 1,
									finalizedAt: 1
								},
								$push: {
									audit: {
										at: new Date(),
										actorId: 'inventory-reconcile',
										action: 'source_changed',
										note: 'Canonical S3 content hash changed; prior verdict cleared.'
									}
								}
							}
						}
					})),
					{ ordered: false }
				);
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
	await connectDb();
	const normalized = normalizeFilters(filters);
	await reconcileQuestionInventory();
	if (normalized.qualityState && normalized.qualityState !== 'unreviewed') {
		throw new Error(
			'V1 review runs only accept unreviewed questions to prevent duplicate labeling'
		);
	}
	if (normalized.apClass || normalized.unit) {
		const unsynced = await QuestionId.countDocuments({ metadataSyncedAt: { $exists: false } });
		if (unsynced) {
			throw new Error(
				`Hydrate the S3 registry before class/unit filtering: bun run sync:question-ids --hydrate (${unsynced} unsynced)`
			);
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

async function refreshJobCounts(jobId: mongoose.Types.ObjectId | string): Promise<void> {
	const [counts, costs] = await Promise.all([
		QuestionQualityReviewJobItem.aggregate<{ _id: string; count: number }>([
			{ $match: { jobId: new mongoose.Types.ObjectId(String(jobId)) } },
			{ $group: { _id: '$status', count: { $sum: 1 } } }
		]),
		QuestionQualityReviewJobItem.aggregate<{ total: number }>([
			{
				$match: {
					jobId: new mongoose.Types.ObjectId(String(jobId)),
					status: { $in: ['final', 'awaiting_human'] }
				}
			},
			{
				$lookup: {
					from: 'question_quality',
					localField: 'questionId',
					foreignField: 'questionId',
					as: 'quality'
				}
			},
			{ $unwind: { path: '$quality', preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: null,
					total: { $sum: { $ifNull: ['$quality.aiAssessment.usage.estimatedCostUsd', 0] } }
				}
			}
		])
	]);
	const byStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));
	await QuestionQualityReviewJob.updateOne(
		{ _id: jobId },
		{
			$set: {
				queuedCount: (byStatus.queued ?? 0) + (byStatus.preparing ?? 0),
				submittedCount: byStatus.submitted ?? 0,
				awaitingHumanCount: byStatus.awaiting_human ?? 0,
				finalCount: byStatus.final ?? 0,
				failedCount: byStatus.failed ?? 0,
				actualCostUsd: costs[0]?.total ?? 0
			}
		}
	);
}

async function persistCreatedBatch(opts: {
	jobId: mongoose.Types.ObjectId;
	submissionKey: string;
	batch: { id: string; status: string };
}): Promise<boolean> {
	const latest = await QuestionQualityReviewJob.findById(opts.jobId).lean().exec();
	if (!latest || latest.status === 'cancelled') {
		await cancelOpenAiBatch(opts.batch.id).catch(() => undefined);
		await QuestionQualityReviewJobItem.updateMany(
			{ jobId: opts.jobId, status: 'preparing', submissionKey: opts.submissionKey },
			{ $set: { status: 'failed', error: 'Cancelled by administrator during submission' } }
		);
		return false;
	}
	const nextStatus = latest.status === 'paused' ? 'paused' : 'in_progress';
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
		QuestionQualityReviewJobItem.updateMany(
			{ jobId: opts.jobId, status: 'preparing', submissionKey: opts.submissionKey },
			{ $set: { status: 'submitted', batchId: opts.batch.id } }
		)
	]);
	return true;
}

async function submitNextBatch(jobId: string): Promise<void> {
	const leaseUntil = new Date(Date.now() + 5 * 60_000);
	const job = await QuestionQualityReviewJob.findOneAndUpdate(
		{
			_id: jobId,
			status: { $in: ['preparing', 'in_progress'] },
			$or: [{ activeBatchId: { $exists: false } }, { activeBatchId: null }],
			$and: [
				{
					$or: [
						{ submissionLeaseUntil: { $exists: false } },
						{ submissionLeaseUntil: { $lt: new Date() } }
					]
				}
			]
		},
		{ $set: { submissionLeaseUntil: leaseUntil } },
		{ new: true }
	).exec();
	if (!job) return;
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
		await QuestionQualityReviewJobItem.updateMany(
			{
				jobId: job._id,
				status: 'preparing',
				updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) }
			},
			{ $set: { status: 'queued' }, $inc: { attempts: -1 } }
		);

		const items = await QuestionQualityReviewJobItem.find({ jobId: job._id, status: 'queued' })
			.sort({ createdAt: 1 })
			.limit(batchSize())
			.exec();
		if (!items.length) {
			await refreshJobCounts(job._id);
			const awaiting = await QuestionQualityReviewJobItem.countDocuments({
				jobId: job._id,
				status: 'awaiting_human'
			});
			await QuestionQualityReviewJob.updateOne(
				{ _id: job._id },
				{ $set: { status: awaiting ? 'awaiting_human' : 'completed' } }
			);
			return;
		}

		const submissionKey = `${job.id}-${randomUUID()}`;
		const itemIds = items.map((item) => item._id);
		await QuestionQualityReviewJobItem.updateMany(
			{ _id: { $in: itemIds }, status: 'queued' },
			{ $set: { status: 'preparing', submissionKey }, $inc: { attempts: 1 } }
		);
		const claimedItems = await QuestionQualityReviewJobItem.find({
			_id: { $in: itemIds },
			status: 'preparing',
			submissionKey
		}).exec();
		if (!claimedItems.length) return;

		const lines: string[] = [];
		let batchBytes = 0;
		for (const item of claimedItems) {
			try {
				const question = await getQuestionFromS3(item.questionId);
				const requiresWebSearch = requiresWebSearchForQuestion(
					question as unknown as Record<string, unknown>
				);
				await QuestionQualityReviewJobItem.updateOne(
					{ _id: item._id },
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
						{ _id: item._id, status: 'preparing' },
						{
							$set: {
								status: cannotFitAlone ? 'failed' : 'queued',
								...(cannotFitAlone
									? { error: 'Question exceeds the Batch API file-size limit' }
									: {})
							},
							$inc: { attempts: -1 }
						}
					);
					continue;
				}
				lines.push(line);
				batchBytes += lineBytes;
				const serialized = JSON.stringify(question);
				await QuestionId.updateOne(
					{ questionId: item.questionId },
					{
						$set: {
							apClass: question.apClass,
							unit: question.unit,
							questionCreatedAt: question.createdAt ? new Date(question.createdAt) : undefined,
							contentHash: createHash('sha256').update(serialized).digest('hex'),
							contentLength: serialized.length,
							metadataSyncedAt: new Date()
						}
					}
				);
			} catch (error) {
				await QuestionQualityReviewJobItem.updateOne(
					{ _id: item._id },
					{
						$set: {
							status: 'failed',
							error: error instanceof Error ? error.message : String(error)
						}
					}
				);
			}
		}
		if (!lines.length) {
			return;
		}

		const inputFileId = await uploadBatchInput(
			lines.join('\n'),
			`question-quality-${job.id}.jsonl`
		);
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
		await QuestionQualityReviewJob.updateOne(
			{ _id: job._id, submissionLeaseUntil: leaseUntil },
			{ $unset: { submissionLeaseUntil: 1 } }
		);
	}
}

export async function createReviewJob(
	previewId: string,
	actorId = 'admin'
): Promise<QualityJobSummary> {
	await connectDb();
	const job = await QuestionQualityReviewJob.findOneAndUpdate(
		{
			_id: previewId,
			status: 'preview',
			expiresAt: { $gt: new Date() },
			createdBy: actorId
		},
		{ $set: { status: 'preparing' } },
		{ new: true }
	).exec();
	if (!job)
		throw new Error('Preview is missing, expired, already used, or belongs to another admin');

	let inserted = 0;
	for (const questionId of job.selectedQuestionIds) {
		const result = await QuestionQualityReviewJobItem.updateOne(
			{ questionId },
			{
				$setOnInsert: {
					jobId: job._id,
					questionId,
					status: 'queued',
					attempts: 0,
					blind: isCalibrationSample(questionId, job.rubricVersion)
				}
			},
			{ upsert: true }
		);
		if (result.upsertedCount) {
			inserted += 1;
			continue;
		}
		const reclaimed = await QuestionQualityReviewJobItem.updateOne(
			{ questionId, status: 'failed' },
			{
				$set: {
					jobId: job._id,
					status: 'queued',
					attempts: 0,
					blind: isCalibrationSample(questionId, job.rubricVersion),
					error: undefined,
					batchId: undefined,
					submissionKey: undefined
				}
			}
		);
		inserted += reclaimed.modifiedCount;
	}
	job.selectedQuestionIds = [];
	job.selectedCount = inserted;
	job.queuedCount = inserted;
	await job.save();
	await submitNextBatch(job.id);
	const refreshed = await QuestionQualityReviewJob.findById(job.id).lean().exec();
	if (!refreshed) throw new Error('Review job disappeared after creation');
	return toJobSummary(refreshed);
}

async function updateQualityFromBatchLine(
	job: { _id: mongoose.Types.ObjectId; model: string; calibrated: boolean },
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
			item.status = 'queued';
			item.error =
				parsed.error?.message ||
				`OpenAI response status ${parsed.response?.status_code ?? 'unknown'}`;
		} else {
			item.status = 'failed';
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
				state: human.required ? 'awaiting_human' : 'final',
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
			$push: {
				audit: {
					at: now,
					actorId: 'question-quality-agent',
					action: human.required ? 'ai_assessed_for_human' : 'ai_finalized',
					...(!human.required ? { toVerdict: assessment.verdict } : {}),
					note: human.reason
				}
			}
		});
		if (qualityWrite.modifiedCount) {
			item.status = human.required ? 'awaiting_human' : 'final';
		} else {
			let persisted = await QuestionQuality.findOne({ questionId }).lean().exec();
			if (persisted && !persisted.aiAssessment && persisted.needsHumanReview) {
				await QuestionQuality.updateOne(
					{ questionId, aiAssessment: { $exists: false }, needsHumanReview: true },
					{
						$set: { aiAssessment: assessment, state: 'awaiting_human' },
						$push: {
							audit: {
								at: now,
								actorId: 'question-quality-agent',
								action: 'ai_assessed_for_human',
								note: persisted.humanReviewReason || 'student_feedback'
							}
						}
					}
				);
				persisted = await QuestionQuality.findOne({ questionId }).lean().exec();
			}
			item.status = persisted?.needsHumanReview ? 'awaiting_human' : 'final';
		}
		item.error = undefined;
		await item.save();
	} catch (error) {
		await QuestionQuality.updateOne(
			{ questionId },
			{
				$setOnInsert: { questionId },
				$set: {
					state: 'awaiting_human',
					needsHumanReview: true,
					humanReviewReason: 'schema_failure',
					blindHumanReview: false
				}
			},
			{ upsert: true }
		);
		item.status = 'awaiting_human';
		item.error = error instanceof Error ? error.message : String(error);
		await item.save();
	}
}

async function importBatch(
	job: mongoose.HydratedDocument<ReviewJobDocument>,
	outputFileId?: string
): Promise<void> {
	if (outputFileId) {
		const contents = await downloadOpenAiFile(outputFileId);
		for (const line of contents.split('\n').filter(Boolean)) {
			await updateQualityFromBatchLine(job, line);
		}
	}

	const unresolved = await QuestionQualityReviewJobItem.find({
		jobId: job._id,
		batchId: job.activeBatchId,
		status: 'submitted'
	}).exec();
	for (const item of unresolved) {
		item.status = item.attempts < 3 ? 'queued' : 'failed';
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
	await connectDb();
	const leaseUntil = new Date(Date.now() + 55_000);
	const job = await QuestionQualityReviewJob.findOneAndUpdate(
		{
			_id: jobId,
			status: { $in: ACTIVE_JOB_STATUSES },
			$or: [
				{ processingLeaseUntil: { $exists: false } },
				{ processingLeaseUntil: { $lt: new Date() } }
			]
		},
		{ $set: { processingLeaseUntil: leaseUntil } },
		{ new: true }
	).exec();
	if (!job) {
		const existing = await QuestionQualityReviewJob.findById(jobId).lean().exec();
		if (!existing) throw new Error('Review job not found');
		return toJobSummary(existing);
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
		await QuestionQualityReviewJob.updateOne(
			{ _id: job._id, processingLeaseUntil: leaseUntil },
			{ $unset: { processingLeaseUntil: 1 } }
		);
	}
	const refreshed = await QuestionQualityReviewJob.findById(jobId).lean().exec();
	if (!refreshed) throw new Error('Review job not found after refresh');
	return toJobSummary(refreshed);
}

export async function setReviewJobState(
	jobId: string,
	action: 'pause' | 'resume' | 'cancel'
): Promise<QualityJobSummary> {
	await connectDb();
	const job = await QuestionQualityReviewJob.findById(jobId).exec();
	if (!job) throw new Error('Review job not found');
	if (action === 'pause') job.status = 'paused';
	if (action === 'resume') job.status = 'preparing';
	if (action === 'cancel') {
		if (job.activeBatchId) {
			await cancelOpenAiBatch(job.activeBatchId);
			await QuestionQualityReviewJobItem.updateMany(
				{ jobId: job._id, batchId: job.activeBatchId, status: 'submitted' },
				{ $set: { status: 'failed', error: 'Cancelled by administrator' } }
			);
		}
		await QuestionQualityReviewJobItem.updateMany(
			{ jobId: job._id, status: { $in: ['queued', 'preparing'] } },
			{ $set: { status: 'failed', error: 'Cancelled by administrator' } }
		);
		job.status = 'cancelled';
	}
	await job.save();
	if (action === 'resume') return refreshReviewJob(jobId);
	return toJobSummary(job.toObject());
}

export async function recoverActiveReviewJobs(): Promise<number> {
	await connectDb();
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
	await connectDb();
	const now = new Date();
	const result = await QuestionQuality.collection.updateOne({ questionId: opts.questionId }, [
		{
			$set: {
				humanAssessment: {
					verdict: { $literal: opts.verdict },
					notes: { $literal: opts.notes },
					reviewerId: { $literal: opts.reviewerId },
					blind: '$blindHumanReview',
					reviewedAt: now
				},
				finalVerdict: { $literal: opts.verdict },
				finalSource: 'human',
				finalizedAt: now,
				state: 'final',
				needsHumanReview: false,
				blindHumanReview: false,
				audit: {
					$concatArrays: [
						{ $ifNull: ['$audit', []] },
						[
							{
								at: now,
								actorId: { $literal: opts.reviewerId },
								action: {
									$cond: [
										{ $ne: [{ $ifNull: ['$finalVerdict', null] }, null] },
										'human_corrected',
										'human_finalized'
									]
								},
								fromVerdict: '$finalVerdict',
								toVerdict: { $literal: opts.verdict },
								note: { $literal: opts.notes }
							}
						]
					]
				}
			}
		}
	]);
	if (!result.matchedCount) throw new Error('Question quality record not found');
	const item = await QuestionQualityReviewJobItem.findOneAndUpdate(
		{ questionId: opts.questionId },
		{ $set: { status: 'final' } },
		{ new: true }
	).lean();
	if (item) {
		await refreshJobCounts(item.jobId);
		const awaiting = await QuestionQualityReviewJobItem.countDocuments({
			jobId: item.jobId,
			status: 'awaiting_human'
		});
		const active = await QuestionQualityReviewJobItem.countDocuments({
			jobId: item.jobId,
			status: { $in: ['queued', 'preparing', 'submitted'] }
		});
		if (!awaiting && !active) {
			await QuestionQualityReviewJob.updateOne(
				{ _id: item.jobId },
				{ $set: { status: 'completed' } }
			);
		}
	}
}
