import { createHash } from 'node:crypto';
import { Question } from '$lib/server/models/question';
import { SeenQuestion } from '$lib/server/models/seen-question';
import { connectDb } from '$lib/server/db';
import { generateAPQuestion, type GenerateResult } from './ai';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from './cache-miss-coordinator';
import type { IQuestion } from '$lib/server/models/question';

/**
 * Number of questions to keep in the pool per class+unit combo.
 * Configurable via the CACHE_POOL_SIZE environment variable; defaults to 5.
 */
function getPoolSize(): number {
	return Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
}

function normalizeUnit(unit?: string): string {
	return typeof unit === 'string' ? unit.trim() : '';
}

/**
 * How many recently-served topics to pass to the AI for diversity guidance.
 * Fetch more than the pool size so diversity spans across pool generations.
 */
const RECENT_TOPICS_WINDOW = 20;

/**
 * Maximum number of seen-question records kept per user per (class, unit) bucket.
 * Once the bucket is full, the oldest entries are pruned so questions can eventually recycle.
 */
const MAX_SEEN_PER_BUCKET = 100;

/** Normalize and hash the question text for deduplication. */
function computeHash(text: string): string {
	return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

// ── Track in-flight replenishments to avoid duplicate work ──
const replenishing = new Set<string>();

// ── Per-process coalescer: absorbs thundering-herd cache misses within one instance ──
const inFlightMiss = new Map<string, Promise<CachedResult>>();

/** Duration a question holds 'serving' status before expiry and automatic lock reclaim. */
const LOCK_WINDOW_MS = 10_000;

// One-time startup migration: assign status fields to pre-existing documents (safe to re-run)
connectDb()
	.then(() =>
		Question.updateMany(
			{ status: { $exists: false } },
			{ $set: { status: 'available', serveCount: 0, lockedUntil: null } }
		).catch((err) => logger.error('[cache] startup migration failed', { error: err }))
	)
	.catch(() => {});

/**
 * Fetch the topics covered by the most recent questions in the pool for this class+unit.
 * Used to guide the AI toward generating diverse content.
 */
async function getRecentTopics(className: string, unit: string): Promise<string[]> {
	const docs = await Question.find(
		{ apClass: className, unit, topicsCovered: { $exists: true, $ne: '' } },
		{ topicsCovered: 1 },
		{ sort: { createdAt: -1 }, limit: RECENT_TOPICS_WINDOW }
	).lean();
	return docs.map((d) => d.topicsCovered as string).filter(Boolean);
}

/**
 * Generate a single question and insert it into the database pool.
 * Skips insertion if an identical question (by hash) already exists.
 * Returns the saved document's _id as a string, or null on failure/duplicate.
 */
async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const recentTopics = await getRecentTopics(className, normalizeUnit(unit));
		const result = await generateAPQuestion({ className, unit, recentTopics });
		const { answer } = result;

		const contentHash = computeHash(answer.question);

		// Skip if this exact question is already in the pool
		const exists = await Question.exists({ contentHash });
		if (exists) {
			logger.info('[cache] skipping duplicate question (hash collision)', {
				className,
				unit,
				contentHash
			});
			return null;
		}

		const doc = await Question.create({
			apClass: className,
			unit: normalizeUnit(unit),
			question: answer.question,
			optionA: answer.optionA,
			optionB: answer.optionB,
			optionC: answer.optionC,
			optionD: answer.optionD,
			correctAnswer: answer.correctAnswer,
			explanation: answer.explanation,
			contentHash,
			topicsCovered: answer.topicsCovered ?? '',
			lastServedAt: null,
			status: 'available',
			serveCount: 0,
			lockedUntil: null
		});
		return doc._id.toString();
	} catch (err: unknown) {
		// MongoDB duplicate-key error (E11000) — safe to ignore
		if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
			logger.info('[cache] duplicate key on insert, skipping', { className, unit });
			return null;
		}
		logger.error('[cache] generateAndInsert failed', { className, unit, error: err });
		return null;
	}
}

/**
 * Record that a user has seen a question (fire-and-forget).
 * Automatically prunes the oldest entries if the bucket exceeds MAX_SEEN_PER_BUCKET.
 */
async function recordSeen(
	userId: string,
	contentHash: string,
	apClass: string,
	unit: string
): Promise<void> {
	try {
		await SeenQuestion.updateOne(
			{ userId, contentHash },
			{ $setOnInsert: { userId, contentHash, apClass, unit, questionType: 'mcq' } },
			{ upsert: true }
		);

		// Prune oldest entries if bucket is too large
		const count = await SeenQuestion.countDocuments({ userId, apClass, unit, questionType: 'mcq' });
		if (count > MAX_SEEN_PER_BUCKET) {
			const excess = count - MAX_SEEN_PER_BUCKET;
			const oldest = await SeenQuestion.find(
				{ userId, apClass, unit, questionType: 'mcq' },
				{ _id: 1 },
				{ sort: { seenAt: 1 }, limit: excess }
			).lean();
			const ids = oldest.map((d) => d._id);
			await SeenQuestion.deleteMany({ _id: { $in: ids } });
		}
	} catch {
		// Non-critical — don't let history tracking affect the main request
	}
}

/**
 * Replenish the pool for a given class+unit until it has POOL_SIZE available questions.
 * Reclaims any expired serving locks first, then generates questions as needed.
 * Runs in the background — never blocks a user request.
 */
function replenishPool(className: string, unit: string): void {
	const key = `${className}::${normalizeUnit(unit)}`;
	if (replenishing.has(key)) return; // already in progress
	replenishing.add(key);

	(async () => {
		try {
			await connectDb();
			const cacheUnit = normalizeUnit(unit);
			const poolSize = getPoolSize();

			// Reclaim questions stuck in 'serving' due to a crashed or timed-out request
			await Question.updateMany(
				{
					apClass: className,
					unit: cacheUnit,
					status: 'serving',
					lockedUntil: { $lt: new Date() }
				},
				{ $set: { status: 'available', lockedUntil: null } }
			);

			// Generate until the available pool reaches the target size
			for (let i = 0; i < poolSize; i++) {
				const available = await Question.countDocuments({
					apClass: className,
					unit: cacheUnit,
					status: 'available'
				});
				if (available >= poolSize) break;

				logger.info(`[cache] replenishing - available: ${available}/${poolSize}`, {
					className,
					unit: cacheUnit
				});
				await generateAndInsert(className, unit);
			}

			const after = await Question.countDocuments({
				apClass: className,
				unit: cacheUnit,
				status: 'available'
			});
			logger.info(`[cache] replenish done - ${after} available question(s)`, {
				className,
				unit: cacheUnit
			});
		} catch (err) {
			logger.error('[cache] replenishPool error', { className, unit, error: err });
		} finally {
			replenishing.delete(key);
		}
	})();
}

/**
 * Atomically claim the least-recently-served available question.
 * Uses findOneAndUpdate so the document is never removed from the pool.
 * Returns the pre-update document (serveCount is the current value) or null on a miss.
 */
async function claimQuestion(filter: Record<string, unknown>) {
	const lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS);
	return Question.findOneAndUpdate(
		{ ...filter, status: 'available' },
		{ $set: { status: 'serving', lockedUntil } },
		{ sort: { lastServedAt: 1, createdAt: 1 } }
	).exec();
}

async function claimMcqForUser(
	className: string,
	cacheUnit: string,
	userId: string | null | undefined
): Promise<IQuestion | null> {
	await connectDb();

	const baseFilter: Record<string, unknown> = { apClass: className, unit: cacheUnit };

	if (userId) {
		const seenHashes = await SeenQuestion.find(
			{ userId, apClass: className, unit: cacheUnit, questionType: 'mcq' },
			{ contentHash: 1 }
		)
			.lean()
			.then((docs) => docs.map((d) => d.contentHash));

		if (seenHashes.length > 0) {
			baseFilter['contentHash'] = { $nin: seenHashes };
		}
	}

	let doc = await claimQuestion(baseFilter);

	if (!doc && userId) {
		logger.info('[cache] all pooled questions already seen by user, falling back to any', {
			className,
			unit: cacheUnit,
			userId
		});
		doc = await claimQuestion({ apClass: className, unit: cacheUnit });
	}

	return doc;
}

function serveClaimedMcqDoc(
	doc: IQuestion,
	className: string,
	cacheUnit: string,
	userId: string | null | undefined
): CachedResult {
	releaseQuestion(doc._id.toString(), doc.serveCount ?? 0, doc.maxServeCount ?? 50);

	if (userId && doc.contentHash) {
		recordSeen(userId, doc.contentHash, className, cacheUnit).catch(() => {});
	}

	replenishPool(className, cacheUnit);

	return {
		answer: {
			question: doc.question,
			optionA: doc.optionA,
			optionB: doc.optionB,
			optionC: doc.optionC,
			optionD: doc.optionD,
			correctAnswer: doc.correctAnswer,
			explanation: doc.explanation,
			topicsCovered: doc.topicsCovered ?? ''
		},
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc._id.toString()
	};
}

/** Insert a live-generated MCQ into the pool so other instances can claim it. */
async function persistMcqToPool(
	className: string,
	cacheUnit: string,
	result: GenerateResult
): Promise<void> {
	const { answer } = result;
	const contentHash = computeHash(answer.question);
	const exists = await Question.exists({ contentHash });
	if (exists) return;

	try {
		await Question.create({
			apClass: className,
			unit: cacheUnit,
			question: answer.question,
			optionA: answer.optionA,
			optionB: answer.optionB,
			optionC: answer.optionC,
			optionD: answer.optionD,
			correctAnswer: answer.correctAnswer,
			explanation: answer.explanation,
			contentHash,
			topicsCovered: answer.topicsCovered ?? '',
			lastServedAt: null,
			status: 'available',
			serveCount: 0,
			lockedUntil: null
		});
	} catch (err: unknown) {
		if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
			return;
		}
		throw err;
	}
}

/**
 * Return a question to the pool after serving.
 * Increments serveCount and retires the question once it reaches maxServeCount.
 * Fire-and-forget — does not block the user response.
 */
function releaseQuestion(docId: string, currentServeCount: number, maxServeCount: number): void {
	const nextServeCount = currentServeCount + 1;
	const nextStatus: 'available' | 'retired' =
		nextServeCount >= maxServeCount ? 'retired' : 'available';
	Question.updateOne(
		{ _id: docId },
		{
			$inc: { serveCount: 1 },
			$set: { lastServedAt: new Date(), lockedUntil: null, status: nextStatus }
		}
	).catch(() => {});
}

export type CachedResult = GenerateResult & { cached: boolean };

/**
 * Main entry point for the question API.
 *
 * 1. Atomically claim the least-recently-served available question from the pool.
 * 2. Release it back to the pool (or retire it) after serving — non-destructive.
 * 3. Record it in the user's seen-question history (non-blocking).
 * 4. Kick off background replenishment if the pool is low.
 * 5. On pool empty: coalesce concurrent misses into a single live AI call.
 * 6. If the DB fails entirely, fall back to live AI generation.
 */
export async function getCachedQuestion(
	className: string,
	unit?: string,
	userId?: string | null
): Promise<CachedResult> {
	const cacheUnit = normalizeUnit(unit);

	let doc: IQuestion | null;
	try {
		doc = await claimMcqForUser(className, cacheUnit, userId);
	} catch (err) {
		// ── DB failure: fall back to live generation ──
		logger.warn('[cache] DB read failed, falling back to live generation', {
			className,
			unit: cacheUnit,
			error: err
		});
		const result = await generateAPQuestion({ className, unit: unit ?? '' });
		return { ...result, cached: false };
	}

	if (doc) {
		return serveClaimedMcqDoc(doc, className, cacheUnit, userId);
	}

	// ── Cache miss (empty pool): per-process coalescer + cluster lock for serverless ──
	const missKey = `miss::mcq::${className}::${cacheUnit}`;
	const clusterLockKey = missKey;

	if (inFlightMiss.has(missKey)) {
		logger.info('[cache] coalescing duplicate cache miss', { className, unit: cacheUnit });
		return inFlightMiss.get(missKey)!;
	}

	logger.info('[cache] pool empty, generating live question', { className, unit: cacheUnit });
	replenishPool(className, unit ?? '');

	const livePromise: Promise<CachedResult> = (async (): Promise<CachedResult> => {
		try {
			const { result, meta } = await runCacheMissClusterFlow<CachedResult>({
				clusterLockKey,
				tryClaim: async () => {
					const claimed = await claimMcqForUser(className, cacheUnit, userId);
					if (!claimed) return null;
					return serveClaimedMcqDoc(claimed, className, cacheUnit, userId);
				},
				leaderRun: async () => {
					const recentTopics = await getRecentTopics(className, cacheUnit).catch(() => []);
					const gen = await generateAPQuestion({
						className,
						unit: unit ?? '',
						recentTopics
					});
					await persistMcqToPool(className, cacheUnit, gen);
					if (userId) {
						const hash = computeHash(gen.answer.question);
						recordSeen(userId, hash, className, cacheUnit).catch(() => {});
					}
					return { ...gen, cached: false };
				},
				logScope: 'cache'
			});

			logger.info('[cache] cache_miss_cluster_complete', {
				className,
				unit: cacheUnit,
				cache_miss_role: meta.role,
				cache_miss_follower_wait_ms: meta.cache_miss_follower_wait_ms
			});

			return result;
		} catch (err) {
			logger.error('[cache] live generation also failed', {
				className,
				unit: cacheUnit,
				error: err
			});
			throw err;
		} finally {
			inFlightMiss.delete(missKey);
		}
	})();

	inFlightMiss.set(missKey, livePromise);
	return livePromise;
}

/**
 * Generate a question and add it to the pool (used by the admin /cache/generate endpoint).
 */
export async function generateAndStoreQuestion(
	className: string,
	unit?: string
): Promise<CachedResult> {
	if (typeof className !== 'string' || !className.trim()) {
		throw new Error('Invalid className: must be a non-empty string');
	}

	await connectDb();

	const recentTopics = await getRecentTopics(className, normalizeUnit(unit)).catch(() => []);
	const result = await generateAPQuestion({
		className: className.trim(),
		unit: unit ?? '',
		recentTopics
	});
	const { answer } = result;

	const contentHash = computeHash(answer.question);

	try {
		await Question.create({
			apClass: className.trim(),
			unit: normalizeUnit(unit),
			question: answer.question,
			optionA: answer.optionA,
			optionB: answer.optionB,
			optionC: answer.optionC,
			optionD: answer.optionD,
			correctAnswer: answer.correctAnswer,
			explanation: answer.explanation,
			contentHash,
			topicsCovered: answer.topicsCovered ?? '',
			lastServedAt: null,
			status: 'available',
			serveCount: 0,
			lockedUntil: null
		});
	} catch (err: unknown) {
		if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
			logger.info('[cache] generateAndStoreQuestion: duplicate hash, not re-storing', {
				className
			});
		} else {
			throw err;
		}
	}

	return { ...result, cached: false };
}

// ── Utility helpers (used by admin / stats endpoints) ───────

export async function isCached(className: string, unit?: string): Promise<boolean> {
	await connectDb();
	const count = await Question.countDocuments({
		apClass: className,
		unit: normalizeUnit(unit),
		status: 'available'
	});
	return count > 0;
}

export async function clearCache(): Promise<number> {
	await connectDb();
	const result = await Question.deleteMany({});
	return result.deletedCount;
}

export async function getCacheStats(): Promise<{
	total: number;
	classes: number;
	available: number;
	serving: number;
	retired: number;
}> {
	await connectDb();
	const [total, classes, available, serving, retired] = await Promise.all([
		Question.countDocuments(),
		Question.distinct('apClass').then((a) => a.length),
		Question.countDocuments({ status: 'available' }),
		Question.countDocuments({ status: 'serving' }),
		Question.countDocuments({ status: 'retired' })
	]);
	return { total, classes, available, serving, retired };
}
