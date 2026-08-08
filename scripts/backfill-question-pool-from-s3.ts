/**
 * scripts/backfill-question-pool-from-s3.ts
 *
 * Import existing canonical S3 questions into the PostgreSQL active library.
 * Never deletes or rewrites S3 objects. Prefer dry-run before writes.
 *
 *   bun run pool:backfill-s3 --dry-run
 *   bun run pool:backfill-s3
 *   bun run pool:backfill-s3 --enqueue-deficits
 *   bun run pool:backfill-s3 --type mcq
 *   bun run pool:backfill-s3 --type frq --concurrency 8
 */

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createLimiter, getArg, loadCombos } from './shared';
import { getFrqCourseNames } from '../src/lib/frq/profiles.server';
import { FrqQuestionSchema } from '../src/lib/frq/types';
import { FrqQuestionModel } from '../src/lib/frq/model.server';
import { Question } from '../src/lib/questions/cache-model.server';
import {
	QUESTION_POOL_CONFIG,
	poolTargetForBucket,
	type QuestionPoolConfig
} from '../src/lib/questions/pool-constants';
import { getMcqGenerationCountsByClass } from '../src/lib/questions/gen-stats.server';
import { PoolRefillState } from '../src/lib/questions/pool-refill-model.server';
import { connectDb } from '../src/lib/server/db';

const DATABASE_URL = process.env.DATABASE_URL;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const isDryRun = process.argv.includes('--dry-run');
const enqueueDeficits = process.argv.includes('--enqueue-deficits');
const typeFilter = (getArg('--type') ?? 'all').toLowerCase();
const concurrency = Math.max(1, Number.parseInt(getArg('--concurrency') ?? '6', 10) || 6);

if (!DATABASE_URL) {
	console.error('Error: DATABASE_URL is not set.');
	process.exit(1);
}
if (!AWS_S3_BUCKET?.trim()) {
	console.error('Error: AWS_S3_BUCKET is not set.');
	process.exit(1);
}

const QUESTION_KEY_RE = /^questions\/([^/]+)\.json$/;
const FRQ_KEY_RE = /^frqs\/([^/]+)\.json$/;

type BucketKey = string;

function bucketKey(apClass: string, unit: string): BucketKey {
	return `${apClass}::${unit}`;
}

function computeContentHash(text: string): string {
	return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

function createS3Client(): S3Client {
	const region = process.env.AWS_REGION;
	const endpoint = process.env.AWS_S3_ENDPOINT;
	const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
	const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

	const cfg: ConstructorParameters<typeof S3Client>[0] = { region };
	if (endpoint) {
		cfg.endpoint = endpoint;
		cfg.forcePathStyle = forcePathStyle;
	}
	if (accessKeyId && secretAccessKey) {
		cfg.credentials = {
			accessKeyId,
			secretAccessKey,
			...(sessionToken ? { sessionToken } : {})
		};
	}
	return new S3Client(cfg);
}

async function listIds(
	s3: S3Client,
	bucket: string,
	prefix: string,
	keyRe: RegExp
): Promise<string[]> {
	const ids: string[] = [];
	let continuationToken: string | undefined;
	do {
		const resp = await s3.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);
		for (const obj of resp.Contents ?? []) {
			if (!obj.Key) continue;
			const match = obj.Key.match(keyRe);
			if (match) ids.push(match[1]);
		}
		continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
	} while (continuationToken);
	return [...new Set(ids)];
}

async function getJson<T>(s3: S3Client, bucket: string, key: string): Promise<T> {
	const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	if (!resp.Body) throw new Error(`Missing body for ${key}`);
	const raw = await resp.Body.transformToString('utf-8');
	return JSON.parse(raw) as T;
}

type McqStored = {
	id?: string;
	question?: string;
	optionA?: string;
	optionB?: string;
	optionC?: string;
	optionD?: string;
	correctAnswer?: string;
	explanation?: string;
	hint1?: string;
	hint2?: string;
	apClass?: string;
	unit?: string;
	topicsCovered?: string;
};

type Counters = {
	listed: number;
	valid: number;
	invalid: number;
	duplicates: number;
	imported: number;
	linkedExisting: number;
	skippedExisting: number;
	byBucket: Map<BucketKey, number>;
};

function emptyCounters(): Counters {
	return {
		listed: 0,
		valid: 0,
		invalid: 0,
		duplicates: 0,
		imported: 0,
		linkedExisting: 0,
		skippedExisting: 0,
		byBucket: new Map()
	};
}

function bumpBucket(map: Map<BucketKey, number>, key: BucketKey): void {
	map.set(key, (map.get(key) ?? 0) + 1);
}

async function backfillMcq(
	s3: S3Client,
	bucket: string,
	allowed: Set<BucketKey>,
	limit: ReturnType<typeof createLimiter>
): Promise<Counters> {
	const counters = emptyCounters();
	const ids = await listIds(s3, bucket, 'questions/', QUESTION_KEY_RE);
	counters.listed = ids.length;
	const seenHashes = new Set<string>();

	await Promise.all(
		ids.map((questionId) =>
			limit(async () => {
				try {
					const raw = await getJson<McqStored>(s3, bucket, `questions/${questionId}.json`);
					const apClass = typeof raw.apClass === 'string' ? raw.apClass.trim() : '';
					const unit = typeof raw.unit === 'string' ? raw.unit.trim() : '';
					const question = typeof raw.question === 'string' ? raw.question.trim() : '';
					const optionA = typeof raw.optionA === 'string' ? raw.optionA.trim() : '';
					const optionB = typeof raw.optionB === 'string' ? raw.optionB.trim() : '';
					const optionC = typeof raw.optionC === 'string' ? raw.optionC.trim() : '';
					const optionD = typeof raw.optionD === 'string' ? raw.optionD.trim() : '';
					const correctAnswer = String(raw.correctAnswer ?? '')
						.trim()
						.toUpperCase();
					const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';

					if (
						!apClass ||
						!unit ||
						!question ||
						!optionA ||
						!optionB ||
						!optionC ||
						!optionD ||
						!explanation ||
						!['A', 'B', 'C', 'D'].includes(correctAnswer) ||
						!allowed.has(bucketKey(apClass, unit))
					) {
						counters.invalid += 1;
						return;
					}

					const contentHash = computeContentHash(question);
					if (seenHashes.has(contentHash)) {
						counters.duplicates += 1;
						return;
					}
					seenHashes.add(contentHash);
					counters.valid += 1;
					bumpBucket(counters.byBucket, bucketKey(apClass, unit));

					if (isDryRun) return;

					const existing = await Question.findOne({ s3QuestionId: questionId })
						.select({ _id: 1 })
						.lean();
					if (existing) {
						counters.skippedExisting += 1;
						return;
					}

					const existingByContent = await Question.findOne({ contentHash })
						.select({ _id: 1, s3QuestionId: 1 })
						.lean();
					if (existingByContent) {
						if (!existingByContent.s3QuestionId) {
							const result = await Question.updateOne(
								{
									_id: existingByContent._id,
									$or: [
										{ s3QuestionId: { $exists: false } },
										{ s3QuestionId: null },
										{ s3QuestionId: '' }
									]
								},
								{ $set: { s3QuestionId: questionId } }
							);
							if (result.modifiedCount === 1) {
								counters.linkedExisting += 1;
								return;
							}
						}
						counters.duplicates += 1;
						return;
					}

					try {
						await Question.create({
							s3QuestionId: questionId,
							apClass,
							unit,
							contentHash,
							topicsCovered: raw.topicsCovered ?? '',
							question,
							optionA,
							optionB,
							optionC,
							optionD,
							correctAnswer,
							explanation,
							hint1: raw.hint1 ?? '',
							hint2: raw.hint2 ?? '',
							randomKey: Math.random(),
							active: true
						});
						counters.imported += 1;
					} catch (error) {
						const code = (error as { code?: number })?.code;
						if (code === 11000) {
							counters.duplicates += 1;
							return;
						}
						throw error;
					}
				} catch {
					counters.invalid += 1;
				}
			})
		)
	);

	return counters;
}

async function backfillFrq(
	s3: S3Client,
	bucket: string,
	allowed: Set<BucketKey>,
	limit: ReturnType<typeof createLimiter>
): Promise<Counters> {
	const counters = emptyCounters();
	const ids = await listIds(s3, bucket, 'frqs/', FRQ_KEY_RE);
	counters.listed = ids.length;
	const seenHashes = new Set<string>();

	await Promise.all(
		ids.map((questionId) =>
			limit(async () => {
				try {
					const raw = await getJson<Record<string, unknown>>(s3, bucket, `frqs/${questionId}.json`);
					const canonical = { ...raw };
					delete canonical.id;
					delete canonical.createdAt;
					const parsed = FrqQuestionSchema.safeParse(canonical);
					if (!parsed.success) {
						counters.invalid += 1;
						return;
					}
					const question = parsed.data;
					if (!allowed.has(bucketKey(question.apClass, question.unit))) {
						counters.invalid += 1;
						return;
					}

					const contentHash = computeContentHash(
						JSON.stringify({
							prompt: question.prompt,
							materials: question.materials,
							sections: question.sections
						})
					);
					if (seenHashes.has(contentHash)) {
						counters.duplicates += 1;
						return;
					}
					seenHashes.add(contentHash);
					counters.valid += 1;
					bumpBucket(counters.byBucket, bucketKey(question.apClass, question.unit));

					if (isDryRun) return;

					const existing = await FrqQuestion.findOne({ s3QuestionId: questionId })
						.select({ _id: 1 })
						.lean();
					if (existing) {
						counters.skippedExisting += 1;
						return;
					}

					try {
						await FrqQuestion.create({
							...question,
							contentHash,
							s3QuestionId: questionId,
							randomKey: Math.random(),
							active: true
						});
						counters.imported += 1;
					} catch (error) {
						const code = (error as { code?: number })?.code;
						if (code === 11000) {
							counters.duplicates += 1;
							return;
						}
						throw error;
					}
				} catch {
					counters.invalid += 1;
				}
			})
		)
	);

	return counters;
}

function estimateDeficit(
	questionType: 'mcq' | 'frq',
	validByBucket: Map<BucketKey, number>,
	env: QuestionPoolConfig,
	catalogBuckets: Array<{ className: string; unit: string }>,
	generationCountsByClass: Record<string, number>
): { deficitBuckets: number; deficitQuestions: number } {
	let deficitBuckets = 0;
	let deficitQuestions = 0;
	for (const { className, unit } of catalogBuckets) {
		const target = poolTargetForBucket({
			questionType,
			apClass: className,
			generationCountsByClass,
			config: env
		});
		const have = validByBucket.get(bucketKey(className, unit)) ?? 0;
		if (have < target) {
			deficitBuckets += 1;
			deficitQuestions += target - have;
		}
	}
	return { deficitBuckets, deficitQuestions };
}

async function enqueueDeficitsForType(
	questionType: 'mcq' | 'frq',
	env: QuestionPoolConfig,
	catalogBuckets: Array<{ className: string; unit: string }>,
	generationCountsByClass: Record<string, number>
): Promise<number> {
	const Model = questionType === 'mcq' ? Question : FrqQuestionModel;
	let enqueued = 0;
	for (const { className, unit } of catalogBuckets) {
		const target = poolTargetForBucket({
			questionType,
			apClass: className,
			generationCountsByClass,
			config: env
		});
		const observedCount = await Model.countDocuments({
			apClass: className,
			unit,
			active: { $ne: false }
		});
		if (observedCount >= target) continue;
		await PoolRefillState.findOneAndUpdate(
			{ questionType, apClass: className, unit },
			{
				$set: {
					status: 'pending',
					target,
					observedCount,
					requestedAt: new Date(),
					nextAttemptAt: new Date(),
					lastError: null
				},
				$setOnInsert: {
					attempts: 0,
					generatedCount: 0,
					leaseOwner: null,
					leaseExpiresAt: null
				}
			},
			{ upsert: true }
		);
		enqueued += 1;
	}
	return enqueued;
}

function printCounters(label: string, counters: Counters): void {
	console.log(`\n[${label}]`);
	console.log(`  listed=${counters.listed}`);
	console.log(`  valid=${counters.valid}`);
	console.log(`  invalid/legacy=${counters.invalid}`);
	console.log(`  duplicates=${counters.duplicates}`);
	if (!isDryRun) {
		console.log(`  imported=${counters.imported}`);
		console.log(`  linkedExisting=${counters.linkedExisting}`);
		console.log(`  skippedExisting=${counters.skippedExisting}`);
	}
	console.log(`  bucketsWithValid=${counters.byBucket.size}`);
}

async function main() {
	const env = QUESTION_POOL_CONFIG;
	const { combos } = loadCombos();
	const allowed = new Set(combos.map((c) => bucketKey(c.className, c.unit)));
	const frqCourseNames = new Set(getFrqCourseNames());
	const frqCombos = combos.filter((c) => frqCourseNames.has(c.className));

	const s3 = createS3Client();
	const bucket = AWS_S3_BUCKET!.trim();
	const limit = createLimiter(concurrency);

	console.log(isDryRun ? 'Dry-run S3 → PostgreSQL backfill…' : 'Running S3 → PostgreSQL backfill…');
	console.log(`Concurrency=${concurrency}, type=${typeFilter}`);

	await connectDb();
	const generationCountsByClass = await getMcqGenerationCountsByClass();

	if (typeFilter === 'all' || typeFilter === 'mcq') {
		const mcq = await backfillMcq(s3, bucket, allowed, limit);
		printCounters('MCQ', mcq);
		const deficit = estimateDeficit('mcq', mcq.byBucket, env, combos, generationCountsByClass);
		console.log(
			`  deficitAfterImport≈ buckets=${deficit.deficitBuckets}, questions=${deficit.deficitQuestions}, estLlmCalls=${deficit.deficitQuestions}`
		);
	}

	if (typeFilter === 'all' || typeFilter === 'frq') {
		const frq = await backfillFrq(s3, bucket, allowed, limit);
		printCounters('FRQ', frq);
		const deficit = estimateDeficit('frq', frq.byBucket, env, frqCombos, generationCountsByClass);
		console.log(
			`  deficitAfterImport≈ buckets=${deficit.deficitBuckets}, questions=${deficit.deficitQuestions}, estLlmCalls=${deficit.deficitQuestions}`
		);
	}

	if (enqueueDeficits && !isDryRun) {
		let enqueued = 0;
		if (typeFilter === 'all' || typeFilter === 'mcq') {
			enqueued += await enqueueDeficitsForType('mcq', env, combos, generationCountsByClass);
		}
		if (typeFilter === 'all' || typeFilter === 'frq') {
			enqueued += await enqueueDeficitsForType('frq', env, frqCombos, generationCountsByClass);
		}
		console.log(`\nEnqueued ${enqueued} catalog deficit refill job(s).`);
	} else if (enqueueDeficits && isDryRun) {
		console.log('\nDry-run: skipping --enqueue-deficits writes.');
	}

	console.log('\nDone. S3 objects were not modified.');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
