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
			lastServedAt: null
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
			const count = await FRQQuestion.countDocuments({ apClass: className, unit: cacheUnit });
			const needed = POOL_SIZE - count;
			if (needed <= 0) return;

			logger.info(`[frq-cache] replenishing ${needed} FRQ(s)`, { className, unit: cacheUnit });

			for (let i = 0; i < needed; i++) {
				await generateAndInsert(className, unit);
			}

			const after = await FRQQuestion.countDocuments({ apClass: className, unit: cacheUnit });
			logger.info(`[frq-cache] replenish done - pool now has ${after} FRQ(s)`, {
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

		doc = await FRQQuestion.findOneAndDelete(baseFilter, {
			sort: { lastServedAt: 1, createdAt: 1 }
		}).exec();

		// Fall back to any question if user has seen everything in pool
		if (!doc && userId) {
			logger.info('[frq-cache] all pooled FRQs already seen by user, falling back to any', {
				className,
				unit: cacheUnit,
				userId
			});
			doc = await FRQQuestion.findOneAndDelete(
				{ apClass: className, unit: cacheUnit },
				{ sort: { lastServedAt: 1, createdAt: 1 } }
			).exec();
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

	logger.info('[frq-cache] pool empty, generating live FRQ', { className, unit: cacheUnit });
	replenishPool(className, unit ?? '');

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
	}
}
