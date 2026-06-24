import { Question, type IQuestion } from '$lib/questions/cache-model.server';
import { connectDb } from '$lib/server/db';
import { selectModelForClass } from '$lib/ai/service.server';
import {
	generateAPQuestion,
	generateAPQuestionBody,
	persistMcqQuestionToS3,
	persistOrResolveMcqQuestion,
	type GenerateResult
} from '$lib/questions/generation.server';
import { logger } from '$lib/server/logger';
import { createQuestionPool } from '$lib/questions/pool.server';
import { buildSlimPoolDoc } from '$lib/questions/pool-doc.server';
import { loadQuestionBodyFromPoolDoc } from '$lib/questions/pool-resolve.server';
import { getRecentTopics, recordRecentTopic } from '$lib/questions/recent-topic.server';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';

const RECENT_TOPICS_WINDOW = 20;

function getPoolSize(): number {
	return Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
}

async function insertSlimPoolDoc(
	className: string,
	cacheUnit: string,
	s3QuestionId: string,
	answer: GenerateResult['answer']
): Promise<void> {
	const contentHash = computeContentHash(answer.question);
	const topicsCovered = answer.topicsCovered ?? '';

	await recordRecentTopic({
		apClass: className,
		unit: cacheUnit,
		topicsCovered,
		s3QuestionId
	});

	await Question.create(
		buildSlimPoolDoc({
			s3QuestionId,
			apClass: className,
			unit: cacheUnit,
			contentHash,
			topicsCovered
		})
	);
}

async function generateAndInsert(className: string, unit: string): Promise<string | null> {
	try {
		const cacheUnit = normalizeUnit(unit);
		const recentTopics = await getRecentTopics(className, cacheUnit, RECENT_TOPICS_WINDOW);
		const answer = await generateAPQuestionBody({ className, unit, recentTopics });
		const contentHash = computeContentHash(answer.question);

		const exists = await Question.exists({ contentHash });
		if (exists) {
			logger.info('[cache] skipping duplicate question (hash collision)', {
				className,
				unit: cacheUnit,
				contentHash
			});
			return null;
		}

		const s3QuestionId = await persistMcqQuestionToS3(answer, className, cacheUnit, {
			contentHash
		});
		await insertSlimPoolDoc(className, cacheUnit, s3QuestionId, answer);
		return s3QuestionId;
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
	const { answer, questionId } = result;
	if (!questionId) return;

	const contentHash = computeContentHash(answer.question);
	const exists = await Question.exists({ contentHash });
	if (exists) return;

	try {
		await insertSlimPoolDoc(className, cacheUnit, questionId, answer);
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
	getRecentTopics: (className, unit) => getRecentTopics(className, unit, RECENT_TOPICS_WINDOW),
	generateAndInsert,
	serveClaimed: async (doc, className, cacheUnit, _userId, replenish) => {
		replenish(className, cacheUnit);
		const { questionId, answer } = await loadQuestionBodyFromPoolDoc(doc);
		return {
			answer: {
				...answer,
				topicsCovered: answer.topicsCovered ?? doc.topicsCovered ?? ''
			},
			provider: 'cache',
			model: 'cached',
			cached: true,
			questionId
		};
	},
	generateLive: async (className, unit, recentTopics) => {
		const result = await generateAPQuestion({ className, unit, recentTopics });
		return { ...result, cached: false };
	},
	persistLiveToPool: (className, cacheUnit, result) => persistMcqToPool(className, cacheUnit, result),
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

export const getQuestion = mcqPool.getQuestion;

export async function generateAndStoreQuestion(
	className: string,
	unit?: string
): Promise<CachedResult> {
	if (typeof className !== 'string' || !className.trim()) {
		throw new Error('Invalid className: must be a non-empty string');
	}

	await connectDb();

	const cacheUnit = normalizeUnit(unit);
	const recentTopics = await getRecentTopics(className.trim(), cacheUnit, RECENT_TOPICS_WINDOW).catch(
		() => []
	);
	const answer = await generateAPQuestionBody({
		className: className.trim(),
		unit: unit ?? '',
		recentTopics
	});

	const resolved = await persistOrResolveMcqQuestion({
		answer,
		className: className.trim(),
		unit: cacheUnit,
		findExistingS3Id: async (contentHash) => {
			const existing = await Question.findOne({ contentHash }, { s3QuestionId: 1 }).lean();
			return existing?.s3QuestionId ?? null;
		}
	});

	if (resolved.duplicate) {
		logger.info('[cache] generateAndStoreQuestion: duplicate hash, using existing S3 body', {
			className,
			questionId: resolved.questionId
		});
	}

	if (!resolved.duplicate) {
		try {
			await insertSlimPoolDoc(
				className.trim(),
				cacheUnit,
				resolved.questionId,
				resolved.answer
			);
		} catch (err: unknown) {
			if (isDuplicateKeyError(err)) {
				logger.info('[cache] generateAndStoreQuestion: duplicate key on pool insert', {
					className
				});
			} else {
				throw err;
			}
		}
	}

	return {
		answer: resolved.answer,
		provider: 'openai',
		model: selectModelForClass(className.trim()),
		questionId: resolved.questionId,
		cached: false
	};
}
