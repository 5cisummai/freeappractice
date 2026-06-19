import { Question } from '$lib/server/models/question';
import { connectDb } from '$lib/server/db';
import { generateAPQuestion, type GenerateResult } from './question-generate';
import { logger } from '$lib/server/logger';
import { createQuestionPool } from './question-pool';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/server/utils';
import type { IQuestion } from '$lib/server/models/question';

const RECENT_TOPICS_WINDOW = 20;

function getPoolSize(): number {
	return Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
}

async function getRecentTopics(className: string, unit: string): Promise<string[]> {
	const docs = await Question.find(
		{ apClass: className, unit, topicsCovered: { $exists: true, $ne: '' } },
		{ topicsCovered: 1 },
		{ sort: { createdAt: -1 }, limit: RECENT_TOPICS_WINDOW }
	).lean();
	return docs.map((d) => d.topicsCovered as string).filter(Boolean);
}

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const recentTopics = await getRecentTopics(className, normalizeUnit(unit));
		const result = await generateAPQuestion({ className, unit, recentTopics });
		const { answer } = result;
		const contentHash = computeContentHash(answer.question);

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
		if (isDuplicateKeyError(err)) {
			logger.info('[cache] duplicate key on insert, skipping', { className, unit });
			return null;
		}
		logger.error('[cache] generateAndInsert failed', { className, unit, error: err });
		return null;
	}
}

async function persistMcqToPool(
	className: string,
	cacheUnit: string,
	result: GenerateResult
): Promise<void> {
	const { answer } = result;
	const contentHash = computeContentHash(answer.question);
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
		if (isDuplicateKeyError(err)) return;
		throw err;
	}
}

export type CachedResult = GenerateResult & { cached: boolean };

const mcqPool = createQuestionPool<IQuestion, CachedResult>({
	questionType: 'mcq',
	logScope: 'cache',
	defaultUnit: '',
	getPoolSize,
	recentTopicsWindow: RECENT_TOPICS_WINDOW,
	normalizeUnit: (unit) => normalizeUnit(unit),
	model: Question,
	runStartupMigration: () =>
		Question.updateMany(
			{ status: { $exists: false } },
			{ $set: { status: 'available', serveCount: 0, lockedUntil: null } }
		).then(() => undefined),
	getRecentTopics,
	generateAndInsert,
	serveClaimed: (doc, className, cacheUnit, _userId, replenish) => {
		replenish(className, cacheUnit);
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
	},
	generateLive: async (className, unit, recentTopics) => {
		const result = await generateAPQuestion({ className, unit, recentTopics });
		return { ...result, cached: false };
	},
	persistLiveToPool: (className, cacheUnit, result) =>
		persistMcqToPool(className, cacheUnit, result),
	getContentHashFromResult: (result) => computeContentHash(result.answer.question)
});

export async function generateLiveCustomTopicMcq(
	className: string,
	customTopic: string
): Promise<CachedResult> {
	const trimmed = customTopic.trim();
	if (!trimmed) throw new Error('customTopic is required');
	const result = await generateAPQuestion({
		className,
		unit: '',
		customTopic: trimmed
	});
	return { ...result, cached: false };
}

export const getCachedQuestion = mcqPool.getCached;

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
	const contentHash = computeContentHash(answer.question);

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
		if (isDuplicateKeyError(err)) {
			logger.info('[cache] generateAndStoreQuestion: duplicate hash, not re-storing', {
				className
			});
		} else {
			throw err;
		}
	}

	return { ...result, cached: false };
}

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
