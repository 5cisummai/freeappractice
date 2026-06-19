import { FRQQuestion } from '$lib/server/models/frq-question';
import { generateFRQQuestion, type GenerateFRQResult } from './question-generate';
import { logger } from '$lib/server/logger';
import { createQuestionPool } from './question-pool';
import {
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit as normalizeUnitBase
} from '$lib/server/utils';
import type { IFRQQuestion } from '$lib/server/models/frq-question';

const RECENT_TOPICS_WINDOW = 15;

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

function normalizeUnit(unit?: string | null): string {
	return normalizeUnitBase(unit, 'all-units');
}

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
		if (isDuplicateKeyError(err)) return;
		throw err;
	}
}

export type CachedFRQResult = GenerateFRQResult & { cached: boolean };

const frqPool = createQuestionPool<IFRQQuestion, CachedFRQResult>({
	questionType: 'frq',
	logScope: 'frq-cache',
	defaultUnit: 'all-units',
	getPoolSize: getFrqPoolSize,
	recentTopicsWindow: RECENT_TOPICS_WINDOW,
	normalizeUnit,
	model: FRQQuestion,
	runStartupMigration: () =>
		FRQQuestion.updateMany(
			{ status: { $exists: false } },
			{ $set: { status: 'available', serveCount: 0, lockedUntil: null } }
		).then(() => undefined),
	getRecentTopics,
	generateAndInsert,
	serveClaimed: (doc, className, cacheUnit, _userId, replenish) => {
		replenish(className, cacheUnit);
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
	},
	generateLive: async (className, unit, recentTopics) => {
		const result = await generateFRQQuestion({ className, unit, recentTopics });
		return { ...result, cached: false };
	},
	persistLiveToPool: (className, cacheUnit, result) =>
		persistFrqToPool(className, cacheUnit, result),
	getContentHashFromResult: (result) => computeContentHash(result.question.prompt)
});

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

export const getCachedFRQQuestion = frqPool.getCached;
