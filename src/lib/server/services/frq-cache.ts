import { createHash } from 'node:crypto';
import { FRQQuestion } from '$lib/server/models/frq-question';
import { SeenQuestion } from '$lib/server/models/seen-question';
import { connectDb } from '$lib/server/db';
import { generateFRQQuestion, type GenerateFRQResult } from './ai';
import { logger } from '$lib/server/logger';

const POOL_SIZE = 3;
const RECENT_TOPICS_WINDOW = 15;
const MAX_SEEN_PER_BUCKET = 100;

function normalizeUnit(unit?: string): string {
	if (typeof unit === 'string' && unit.trim()) return unit.trim();
	return 'all-units';
}

/** Normalize and hash the FRQ prompt text for deduplication. */
function computeHash(text: string): string {
	return createHash('sha256')
		.update(text.trim().toLowerCase().replace(/\s+/g, ' '))
		.digest('hex');
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

/** Record that a user has seen an FRQ (fire-and-forget). */
async function recordSeen(
	userId: string,
	contentHash: string,
	apClass: string,
	unit: string
): Promise<void> {
	try {
		await SeenQuestion.updateOne(
			{ userId, contentHash },
			{ $setOnInsert: { userId, contentHash, apClass, unit, questionType: 'frq' } },
			{ upsert: true }
		);

		const count = await SeenQuestion.countDocuments({ userId, apClass, unit, questionType: 'frq' });
		if (count > MAX_SEEN_PER_BUCKET) {
			const excess = count - MAX_SEEN_PER_BUCKET;
			const oldest = await SeenQuestion.find(
				{ userId, apClass, unit, questionType: 'frq' },
				{ _id: 1 },
				{ sort: { seenAt: 1 }, limit: excess }
			).lean();
			await SeenQuestion.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
		}
	} catch {
		// Non-critical
	}
}

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const recentTopics = await getRecentTopics(className, normalizeUnit(unit));
		const result = await generateFRQQuestion({ className, unit, recentTopics });
		const { question } = result;

		const contentHash = computeHash(question.prompt);

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
		if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
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

			const available = await FRQQuestion.countDocuments({
				apClass: className,
				unit: cacheUnit,
				status: 'available'
			});
			const needed = POOL_SIZE - available;
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

export async function getCachedFRQQuestion(
	className: string,
	unit?: string,
	userId?: string | null
): Promise<CachedFRQResult> {
	const cacheUnit = normalizeUnit(unit);

	let doc;
	try {
		await connectDb();

		const baseFilter: Record<string, unknown> = { apClass: className, unit: cacheUnit };

		// Prefer questions the user has not already seen
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

		// Atomic non-destructive claim: marks FRQ 'serving' with a soft expiry lock
		doc = await claimFRQ(baseFilter);

		// Fall back to any question if user has seen everything in pool
		if (!doc && userId) {
			logger.info('[frq-cache] all pooled FRQs already seen by user, falling back to any', {
				className,
				unit: cacheUnit,
				userId
			});
			doc = await claimFRQ({ apClass: className, unit: cacheUnit });
		}
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
		// Release: increment serveCount and return to pool or retire when limit reached (fire-and-forget)
		releaseFRQ(doc._id.toString(), doc.serveCount ?? 0, doc.maxServeCount ?? 50);

		if (userId && doc.contentHash) {
			recordSeen(userId, doc.contentHash, className, cacheUnit).catch(() => {});
		}

		replenishPool(className, unit ?? '');

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

	// ── Cache miss (empty pool): use per-process coalescer to cap live AI calls to 1 ──
	const missKey = `miss::${className}::${cacheUnit}`;
	if (inFlightMiss.has(missKey)) {
		logger.info('[frq-cache] coalescing duplicate cache miss', { className, unit: cacheUnit });
		return inFlightMiss.get(missKey)!;
	}

	logger.info('[frq-cache] pool empty, generating live FRQ', { className, unit: cacheUnit });
	replenishPool(className, unit ?? '');

	const livePromise: Promise<CachedFRQResult> = (async (): Promise<CachedFRQResult> => {
		try {
			const recentTopics = await getRecentTopics(className, cacheUnit).catch(() => []);
			const result = await generateFRQQuestion({ className, unit: unit ?? '', recentTopics });

			if (userId) {
				const hash = computeHash(result.question.prompt);
				recordSeen(userId, hash, className, cacheUnit).catch(() => {});
			}

			return { ...result, cached: false };
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
