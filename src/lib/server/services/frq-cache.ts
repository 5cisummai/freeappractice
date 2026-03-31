import { FRQQuestion } from '$lib/server/models/frq-question';
import { connectDb } from '$lib/server/db';
import { generateFRQQuestion, type GenerateFRQResult } from './ai';
import { logger } from '$lib/server/logger';

const POOL_SIZE = 3;

function normalizeUnit(unit?: string): string {
	if (typeof unit === 'string' && unit.trim()) return unit.trim();
	return 'all-units';
}

const replenishing = new Set<string>();

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const result = await generateFRQQuestion({ className, unit });
		const { question } = result;
		const doc = await FRQQuestion.create({
			apClass: className,
			unit: normalizeUnit(unit),
			prompt: question.prompt,
			context: question.context ?? undefined,
			parts: question.parts,
			totalPoints: question.totalPoints,
			lastServedAt: null
		});
		return doc._id.toString();
	} catch (err) {
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
			logger.info(`[frq-cache] replenish done — pool now has ${after} FRQ(s)`, {
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
	unit?: string
): Promise<CachedFRQResult> {
	const cacheUnit = normalizeUnit(unit);

	let doc;
	try {
		await connectDb();

		doc = await FRQQuestion.findOneAndDelete(
			{ apClass: className, unit: cacheUnit },
			{ sort: { lastServedAt: 1, createdAt: 1 } }
		).exec();
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
		replenishPool(className, unit ?? '');

		return {
			question: {
				prompt: doc.prompt,
				context: doc.context ?? null,
				parts: doc.parts,
				totalPoints: doc.totalPoints
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
		const result = await generateFRQQuestion({ className, unit: unit ?? '' });
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
