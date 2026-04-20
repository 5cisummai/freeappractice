import { FRQQuestion } from '$lib/server/models/frq-question';
import { SeenQuestion } from '$lib/server/models/seen-question';
import { connectDb } from '$lib/server/db';
import { generateFRQQuestion, type GenerateFRQResult } from './question-generate';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from './cache-miss-coordinator';
import {
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit as normalizeUnitBase,
	recordSeenQuestion
} from '$lib/server/utils';
import type { IFRQQuestion } from '$lib/server/models/frq-question';

/**
 * FRQ pool size: CACHE_POOL_SIZE_FRQ, else CACHE_POOL_SIZE, else default 3 (legacy).
 */
function getFrqPoolSize(): number {
	const explicit = process.env.CACHE_POOL_SIZE_FRQ;
	if (explicit !== undefined && explicit !== '') {
		return Math.max(1, parseInt(explicit, 10) || 3);
	}
	const shared = process.env.CACHE_POOL_SIZE;
	if (shared !== undefined && shared !== '') {
		return Math.max(1, parseInt(shared, 10) || 3);
	}
	return 3;
}
const RECENT_TOPICS_WINDOW = 15;

/** FRQ cache uses 'all-units' as the default unit. */
function normalizeUnit(unit?: string | null): string {
	return normalizeUnitBase(unit, 'all-units');
}

const replenishing = new Set<string>();

// ── Per-process coalescer: absorbs thundering-herd cache misses within one instance ──
const inFlightMiss = new Map<string, Promise<CachedFRQResult>>();

/** Duration an FRQ holds 'serving' status before expiry and automatic lock reclaim. */
const LOCK_WINDOW_MS = 10_000;

// One-time startup migration: assign status fields to pre-existing FRQ documents (safe to re-run)
connectDb()
	.then(() =>
		FRQQuestion.updateMany(
			{ status: { $exists: false } },
			{ $set: { status: 'available', serveCount: 0, lockedUntil: null } }
		).catch((err) => logger.error('[frq-cache] startup migration failed', { error: err }))
	)
	.catch(() => {});

/** Fetch recent FRQ topics for diversity guidance. */
async function getRecentTopics(className: string, unit: string): Promise<string[]> {
	const docs = await FRQQuestion.find(
		{ apClass: className, unit, topicsCovered: { $exists: true, $ne: '' } },
		{ topicsCovered: 1 },
		{ sort: { createdAt: -1 }, limit: RECENT_TOPICS_WINDOW }
	).lean();
	return docs.map((d) => d.topicsCovered as string).filter(Boolean);
}

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const recentTopics = await getRecentTopics(className, normalizeUnit(unit));
		const result = await generateFRQQuestion({ className, unit, recentTopics });
		const { question } = result;

		const contentHash = computeContentHash(question.prompt);

		const exists = await FRQQuestion.exists({ contentHash });
		if (exists) {
			logger.info('[frq-cache] skipping duplicate FRQ (hash collision)', {
				className,
				unit,
				contentHash
			});
			return null;
		}

		const doc = await FRQQuestion.create({
			apClass: className,
			unit: normalizeUnit(unit),
			prompt: question.prompt,
			context: question.context ?? undefined,
			parts: question.parts,
			totalPoints: question.totalPoints,
			contentHash,
			topicsCovered: question.topicsCovered ?? '',
			lastServedAt: null,
			status: 'available',
			serveCount: 0,
			lockedUntil: null
		});
		return doc._id.toString();
	} catch (err: unknown) {
		if (isDuplicateKeyError(err)) {
			logger.info('[frq-cache] duplicate key on insert, skipping', { className, unit });
			return null;
		}
		logger.error('[frq-cache] generateAndInsert failed', { className, unit, error: err });
		return null;
	}
}

function replenishPool(className: string, unit: string): void {
	const key = `${className}::${normalizeUnit(unit)}`;
	if (replenishing.has(key)) return;
	replenishing.add(key);

	(async () => {
		try {
			await connectDb();
			const cacheUnit = normalizeUnit(unit);

			// Reclaim FRQs stuck in 'serving' due to a crashed or timed-out request
			await FRQQuestion.updateMany(
				{
					apClass: className,
					unit: cacheUnit,
					status: 'serving',
					lockedUntil: { $lt: new Date() }
				},
				{ $set: { status: 'available', lockedUntil: null } }
			);

			const poolSize = getFrqPoolSize();
			const available = await FRQQuestion.countDocuments({
				apClass: className,
				unit: cacheUnit,
				status: 'available'
			});
			const needed = poolSize - available;
			if (needed <= 0) return;

			logger.info(`[frq-cache] replenishing ${needed} FRQ(s)`, { className, unit: cacheUnit });

			for (let i = 0; i < needed; i++) {
				await generateAndInsert(className, unit);
			}

			const after = await FRQQuestion.countDocuments({
				apClass: className,
				unit: cacheUnit,
				status: 'available'
			});
			logger.info(`[frq-cache] replenish done - ${after} available FRQ(s)`, {
				className,
				unit: cacheUnit
			});
		} catch (err) {
			logger.error('[frq-cache] replenishPool error', { className, unit, error: err });
		} finally {
			replenishing.delete(key);
		}
	})();
}

/**
 * Atomically claim the least-recently-served available FRQ.
 * Uses findOneAndUpdate so the document is never removed from the pool.
 * Returns the pre-update document (serveCount is the current value) or null on a miss.
 */
async function claimFRQ(filter: Record<string, unknown>) {
	const lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS);
	return FRQQuestion.findOneAndUpdate(
		{ ...filter, status: 'available' },
		{ $set: { status: 'serving', lockedUntil } },
		{ sort: { lastServedAt: 1, createdAt: 1 } }
	).exec();
}

async function claimFrqForUser(
	className: string,
	cacheUnit: string,
	userId: string | null | undefined
): Promise<IFRQQuestion | null> {
	await connectDb();

	const baseFilter: Record<string, unknown> = { apClass: className, unit: cacheUnit };

	if (userId) {
		const seenHashes = await SeenQuestion.find(
			{ userId, apClass: className, unit: cacheUnit, questionType: 'frq' },
			{ contentHash: 1 }
		)
			.lean()
			.then((docs) => docs.map((d) => d.contentHash));

		if (seenHashes.length > 0) {
			baseFilter['contentHash'] = { $nin: seenHashes };
		}
	}

	let doc = await claimFRQ(baseFilter);

	if (!doc && userId) {
		logger.info('[frq-cache] all pooled FRQs already seen by user, falling back to any', {
			className,
			unit: cacheUnit,
			userId
		});
		doc = await claimFRQ({ apClass: className, unit: cacheUnit });
	}

	return doc;
}

function serveClaimedFrqDoc(
	doc: IFRQQuestion,
	className: string,
	cacheUnit: string,
	userId: string | null | undefined
): CachedFRQResult {
	releaseFRQ(doc._id.toString(), doc.serveCount ?? 0, doc.maxServeCount ?? 50);

	if (userId && doc.contentHash) {
		recordSeenQuestion(userId, doc.contentHash, className, cacheUnit, 'frq').catch(() => {});
	}

	replenishPool(className, cacheUnit);

	return {
		question: {
			prompt: doc.prompt,
			context: doc.context ?? null,
			parts: doc.parts,
			totalPoints: doc.totalPoints,
			topicsCovered: doc.topicsCovered ?? ''
		},
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc._id.toString()
	};
}

async function persistFrqToPool(
	className: string,
	cacheUnit: string,
	result: GenerateFRQResult
): Promise<void> {
	const { question } = result;
	const contentHash = computeContentHash(question.prompt);
	const exists = await FRQQuestion.exists({ contentHash });
	if (exists) return;

	try {
		await FRQQuestion.create({
			apClass: className,
			unit: cacheUnit,
			prompt: question.prompt,
			context: question.context ?? undefined,
			parts: question.parts,
			totalPoints: question.totalPoints,
			contentHash,
			topicsCovered: question.topicsCovered ?? '',
			lastServedAt: null,
			status: 'available',
			serveCount: 0,
			lockedUntil: null
		});
	} catch (err: unknown) {
		if (isDuplicateKeyError(err)) {
			return;
		}
		throw err;
	}
}

/**
 * Return an FRQ to the pool after serving.
 * Increments serveCount and retires the FRQ once it reaches maxServeCount.
 * Fire-and-forget — does not block the user response.
 */
function releaseFRQ(docId: string, currentServeCount: number, maxServeCount: number): void {
	const nextServeCount = currentServeCount + 1;
	const nextStatus: 'available' | 'retired' =
		nextServeCount >= maxServeCount ? 'retired' : 'available';
	FRQQuestion.updateOne(
		{ _id: docId },
		{
			$inc: { serveCount: 1 },
			$set: { lastServedAt: new Date(), lockedUntil: null, status: nextStatus }
		}
	).catch(() => {});
}

export type CachedFRQResult = GenerateFRQResult & { cached: boolean };

/**
 * Live FRQ for a user-specified topic only — does not read or write the pooled cache.
 */
export async function generateLiveCustomTopicFrq(
	className: string,
	customTopic: string
): Promise<CachedFRQResult> {
	const trimmed = customTopic.trim();
	if (!trimmed) throw new Error('customTopic is required');
	const result = await generateFRQQuestion({
		className,
		unit: '',
		customTopic: trimmed
	});
	return { ...result, cached: false };
}

export async function getCachedFRQQuestion(
	className: string,
	unit?: string,
	userId?: string | null
): Promise<CachedFRQResult> {
	const cacheUnit = normalizeUnit(unit);

	let doc: IFRQQuestion | null;
	try {
		doc = await claimFrqForUser(className, cacheUnit, userId);
	} catch (err) {
		logger.warn('[frq-cache] DB read failed, falling back to live generation', {
			className,
			unit: cacheUnit,
			error: err
		});
		const result = await generateFRQQuestion({ className, unit: unit ?? '' });
		return { ...result, cached: false };
	}

	if (doc) {
		return serveClaimedFrqDoc(doc, className, cacheUnit, userId);
	}

	const missKey = `miss::frq::${className}::${cacheUnit}`;
	const clusterLockKey = missKey;

	if (inFlightMiss.has(missKey)) {
		logger.info('[frq-cache] coalescing duplicate cache miss', { className, unit: cacheUnit });
		return inFlightMiss.get(missKey)!;
	}

	logger.info('[frq-cache] pool empty, generating live FRQ', { className, unit: cacheUnit });
	replenishPool(className, unit ?? '');

	const livePromise: Promise<CachedFRQResult> = (async (): Promise<CachedFRQResult> => {
		try {
			const { result, meta } = await runCacheMissClusterFlow<CachedFRQResult>({
				clusterLockKey,
				tryClaim: async () => {
					const claimed = await claimFrqForUser(className, cacheUnit, userId);
					if (!claimed) return null;
					return serveClaimedFrqDoc(claimed, className, cacheUnit, userId);
				},
				leaderRun: async () => {
					const recentTopics = await getRecentTopics(className, cacheUnit).catch(() => []);
					const gen = await generateFRQQuestion({
						className,
						unit: unit ?? '',
						recentTopics
					});
					await persistFrqToPool(className, cacheUnit, gen);
					if (userId) {
						const hash = computeContentHash(gen.question.prompt);
						recordSeenQuestion(userId, hash, className, cacheUnit, 'frq').catch(() => {});
					}
					return { ...gen, cached: false };
				},
				logScope: 'frq-cache'
			});

			logger.info('[frq-cache] cache_miss_cluster_complete', {
				className,
				unit: cacheUnit,
				cache_miss_role: meta.role,
				cache_miss_follower_wait_ms: meta.cache_miss_follower_wait_ms
			});

			return result;
		} catch (err) {
			logger.error('[frq-cache] live generation also failed', {
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
