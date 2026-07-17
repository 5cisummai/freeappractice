import { Question, type IQuestion } from '$lib/questions/cache-model.server';
import {
	generateAPQuestion,
	type APQuestionData,
	type GenerateResult
} from '$lib/questions/generation.server';
import { logger } from '$lib/server/logger';
import { createQuestionPool, type GetQuestionOptions } from '$lib/questions/pool.server';
import { buildHotPoolDoc } from '$lib/questions/pool-doc.server';
import { hotPoolBodyFromDoc } from '$lib/questions/pool-resolve.server';
import { getRecentTopics, recordRecentTopic } from '$lib/questions/recent-topic.server';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';
import { QuestionGenerationError } from '$lib/questions/question-errors.server';

export type { GetQuestionOptions };

const RECENT_TOPICS_WINDOW = 20;

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

/** AI -> S3 -> Mongo hot pool. Used by standard cache misses. */
async function generateQuestionForPool(
	className: string,
	unit: string,
	recentTopics: string[]
): Promise<GenerateResult> {
	const cacheUnit = normalizeUnit(unit);
	const result = await generateAPQuestion({ className, unit, recentTopics });
	const { answer, questionId } = result;
	if (!questionId) {
		throw new QuestionGenerationError('Generated question was not persisted to S3');
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

	const poolInsertStarted = Date.now();
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

	return {
		...result,
		timing: {
			generationMs: result.timing?.generationMs ?? 0,
			persistenceMs: (result.timing?.persistenceMs ?? 0) + (Date.now() - poolInsertStarted)
		}
	};
}

export type CachedResult = GenerateResult & { cached: boolean };

const mcqPool = createQuestionPool<IQuestion, CachedResult>({
	questionType: 'mcq',
	logScope: 'cache',
	normalizeUnit: (unit) => normalizeUnit(unit),
	model: Question,
	getRecentTopics: (className, unit) => getRecentTopics(className, unit, RECENT_TOPICS_WINDOW),
	serveCached: async (doc) => {
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
	},
	getLiveTiming: (result) => result.timing
});

export const getQuestion = mcqPool.getQuestion;
