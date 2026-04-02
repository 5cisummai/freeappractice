import { Question } from '$lib/server/models/question';
import { connectDb } from '$lib/server/db';
import { generateAPQuestion, type GenerateResult } from './ai';
import { logger } from '$lib/server/logger';

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

// ── Track in-flight replenishments to avoid duplicate work ──
const replenishing = new Set<string>();

/**
 * Generate a single question and insert it into the database pool.
 * Returns the saved document's _id as a string, or null on failure.
 */
async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const result = await generateAPQuestion({ className, unit });
		const { answer } = result;
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
			lastServedAt: null
		});
		return doc._id.toString();
	} catch (err) {
		logger.error('[cache] generateAndInsert failed', { className, unit, error: err });
		return null;
	}
}

/**
 * Replenish the pool for a given class+unit until it has POOL_SIZE questions.
 * Runs in the background - never blocks a user request.
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

			// Re-check count before each generation so multiple concurrent serverless
			// instances converge on the same target and don't over-generate.
			for (let i = 0; i < poolSize; i++) {
				const current = await Question.countDocuments({ apClass: className, unit: cacheUnit });
				if (current >= poolSize) break;

				logger.info(`[cache] replenishing slot ${current + 1}/${poolSize}`, {
					className,
					unit: cacheUnit
				});
				await generateAndInsert(className, unit);
			}

			const after = await Question.countDocuments({ apClass: className, unit: cacheUnit });
			logger.info(`[cache] replenish done - pool now has ${after} question(s)`, {
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

export type CachedResult = GenerateResult & { cached: boolean };

/**
 * Main entry point for the question API.
 *
 * 1. Pull the least-recently-served question from the DB pool.
 * 2. Mark it as served (update lastServedAt) and remove it from the pool.
 * 3. Kick off background replenishment if the pool is low.
 * 4. If the DB fails entirely, fall back to a live AI generation.
 */
export async function getCachedQuestion(className: string, unit?: string): Promise<CachedResult> {
	const cacheUnit = normalizeUnit(unit);

	let doc;
	try {
		await connectDb();

		// Pick the question that was served least recently (or never served).
		// findOneAndDelete atomically pops it so no two requests get the same question.
		doc = await Question.findOneAndDelete(
			{ apClass: className, unit: cacheUnit },
			{ sort: { lastServedAt: 1, createdAt: 1 } }
		).exec();
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
		// Fire background replenishment (non-blocking)
		replenishPool(className, unit ?? '');

		return {
			answer: {
				question: doc.question,
				optionA: doc.optionA,
				optionB: doc.optionB,
				optionC: doc.optionC,
				optionD: doc.optionD,
				correctAnswer: doc.correctAnswer,
				explanation: doc.explanation
			},
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId: doc._id.toString()
		};
	}

	// ── Cache miss (empty pool): generate live, also start replenishing ──
	logger.info('[cache] pool empty, generating live question', { className, unit: cacheUnit });
	replenishPool(className, unit ?? '');

	try {
		const result = await generateAPQuestion({ className, unit: unit ?? '' });
		return { ...result, cached: false };
	} catch (err) {
		logger.error('[cache] live generation also failed', {
			className,
			unit: cacheUnit,
			error: err
		});
		throw err;
	}
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
	const result = await generateAPQuestion({ className: className.trim(), unit: unit ?? '' });
	const { answer } = result;

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
		lastServedAt: null
	});

	return { ...result, cached: false };
}

// ── Utility helpers (used by admin / stats endpoints) ───────

export async function isCached(className: string, unit?: string): Promise<boolean> {
	await connectDb();
	const count = await Question.countDocuments({ apClass: className, unit: normalizeUnit(unit) });
	return count > 0;
}

export async function clearCache(): Promise<number> {
	await connectDb();
	const result = await Question.deleteMany({});
	return result.deletedCount;
}

export async function getCacheStats(): Promise<{ total: number; classes: number }> {
	await connectDb();
	const total = await Question.countDocuments();
	const classes = (await Question.distinct('apClass')).length;
	return { total, classes };
}
