import { Question, type IQuestion } from '$lib/questions/cache-model.server';
import { connectDb } from '$lib/server/db';
import {
	generateAPQuestion,
	type APQuestionData,
	type GenerateResult
} from '$lib/questions/generation.server';
import { logger } from '$lib/server/logger';
import { createMcqPool } from '$lib/questions/pool.server';
import { buildHotPoolDoc } from '$lib/questions/pool-doc.server';
import { hotPoolBodyFromDoc } from '$lib/questions/pool-resolve.server';
import { getRecentTopics, recordRecentTopic } from '$lib/questions/recent-topic.server';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';

const RECENT_TOPICS_WINDOW = 20;

function getPoolSize(): number {
	return Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
}

async function insertHotPoolDoc(
	className: string,
	cacheUnit: string,
	answer: APQuestionData,
	s3QuestionId: string
): Promise<IQuestion> {
	const contentHash = computeContentHash(answer.question);
	const topicsCovered = answer.topicsCovered ?? '';

	await recordRecentTopic({
		apClass: className,
		unit: cacheUnit,
		topicsCovered,
		s3QuestionId
	});

	return Question.create(
		buildHotPoolDoc({
			apClass: className,
			unit: cacheUnit,
			contentHash,
			topicsCovered,
			answer,
			s3QuestionId
		})
	);
}

/** AI -> S3 -> Mongo hot pool. Used by background refill, cache miss, and manual warm. */
async function generateQuestionForPool(
	className: string,
	unit: string,
	recentTopics: string[]
): Promise<GenerateResult> {
	const cacheUnit = normalizeUnit(unit);
	const result = await generateAPQuestion({ className, unit, recentTopics });
	const { answer, questionId } = result;
	if (!questionId) {
		throw new Error('Generated question was not persisted to S3');
	}

	const contentHash = computeContentHash(answer.question);
	const exists = await Question.exists({ contentHash });
	if (exists) {
		logger.info('[cache] generated duplicate question already in pool', {
			className,
			unit: cacheUnit,
			contentHash
		});
		return result;
	}

	try {
		await insertHotPoolDoc(className, cacheUnit, answer, questionId);
	} catch (err: unknown) {
		if (isDuplicateKeyError(err)) {
			logger.info('[cache] duplicate key on pool insert, keeping generated result', {
				className,
				unit: cacheUnit,
				contentHash
			});
			return result;
		}
		throw err;
	}

	return result;
}

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const cacheUnit = normalizeUnit(unit);
		const recentTopics = await getRecentTopics(className, cacheUnit, RECENT_TOPICS_WINDOW);
		const result = await generateQuestionForPool(className, unit, recentTopics);
		return result.questionId ?? null;
	} catch (err: unknown) {
		logger.error('[cache] generateAndInsert failed', { className, unit, error: err });
		return null;
	}
}

export type CachedResult = GenerateResult & { cached: boolean };

const mcqPool = createMcqPool<IQuestion, CachedResult>({
	logScope: 'cache',
	getPoolSize,
	normalizeUnit: (unit) => normalizeUnit(unit),
	model: Question,
	getRecentTopics: (className, unit) => getRecentTopics(className, unit, RECENT_TOPICS_WINDOW),
	generateAndInsert,
	serveClaimed: async (doc, className, cacheUnit, replenish) => {
		replenish(className, cacheUnit);

		const answer = hotPoolBodyFromDoc(doc);
		const topicsCovered = answer.topicsCovered ?? doc.topicsCovered ?? '';

		return {
			answer: { ...answer, topicsCovered },
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId: doc.s3QuestionId
		};
	},
	generateLive: async (className, unit, recentTopics) => {
		const result = await generateQuestionForPool(className, unit, recentTopics ?? []);
		return { ...result, cached: false };
	}
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

export const getQuestion = mcqPool.getQuestion;

/** Warm the hot pool through the same AI -> S3 -> Mongo path used by cache misses. */
export async function generateAndStoreQuestion(
	className: string,
	unit?: string
): Promise<CachedResult> {
	if (typeof className !== 'string' || !className.trim()) {
		throw new Error('Invalid className: must be a non-empty string');
	}

	await connectDb();

	const cacheUnit = normalizeUnit(unit);
	const recentTopics = await getRecentTopics(
		className.trim(),
		cacheUnit,
		RECENT_TOPICS_WINDOW
	).catch(() => []);
	const result = await generateQuestionForPool(className.trim(), unit ?? '', recentTopics);
	return { ...result, cached: false };
}
