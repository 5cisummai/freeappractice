import { Question, type IQuestion } from '$lib/questions/cache-model.server';
import {
	generateAPQuestion,
	type APQuestionData,
	type GenerateResult
} from '$lib/questions/generation.server';
import { logger } from '$lib/server/logger';
import { createQuestionPool } from '$lib/questions/pool.server';
import { getRecentTopics, recordRecentTopic } from '$lib/questions/recent-topic.server';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';
import { QuestionGenerationError } from '$lib/questions/question-errors.server';

type CachedResult = GenerateResult & { cached: boolean };

/** Build an ephemeral hot-cache pool document with the full MCQ body inline. */
function buildHotPoolDoc(opts: {
	s3QuestionId: string;
	apClass: string;
	unit: string;
	contentHash: string;
	answer: APQuestionData;
}): Pick<
	IQuestion,
	| 's3QuestionId'
	| 'apClass'
	| 'unit'
	| 'contentHash'
	| 'topicsCovered'
	| 'question'
	| 'optionA'
	| 'optionB'
	| 'optionC'
	| 'optionD'
	| 'correctAnswer'
	| 'explanation'
	| 'hint1'
	| 'hint2'
> {
	const { answer } = opts;
	return {
		s3QuestionId: opts.s3QuestionId,
		apClass: opts.apClass,
		unit: opts.unit,
		contentHash: opts.contentHash,
		topicsCovered: answer.topicsCovered ?? '',
		question: answer.question,
		optionA: answer.optionA,
		optionB: answer.optionB,
		optionC: answer.optionC,
		optionD: answer.optionD,
		correctAnswer: answer.correctAnswer,
		explanation: answer.explanation,
		hint1: answer.hint1,
		hint2: answer.hint2
	};
}

/** Read full MCQ body directly from a hot-cache pool doc (no S3 round trip). */
function hotPoolBodyFromDoc(doc: IQuestion): APQuestionData {
	return {
		question: doc.question,
		optionA: doc.optionA,
		optionB: doc.optionB,
		optionC: doc.optionC,
		optionD: doc.optionD,
		correctAnswer: doc.correctAnswer,
		explanation: doc.explanation,
		topicsCovered: doc.topicsCovered ?? '',
		hint1: doc.hint1 ?? '',
		hint2: doc.hint2 ?? ''
	};
}

async function insertHotPoolDoc(
	className: string,
	cacheUnit: string,
	answer: APQuestionData,
	s3QuestionId: string
): Promise<IQuestion> {
	await recordRecentTopic({
		apClass: className,
		unit: cacheUnit,
		topicsCovered: answer.topicsCovered ?? '',
		s3QuestionId
	});

	return Question.create(
		buildHotPoolDoc({
			apClass: className,
			unit: cacheUnit,
			contentHash: computeContentHash(answer.question),
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

const mcqPool = createQuestionPool<IQuestion, CachedResult>({
	questionType: 'mcq',
	logScope: 'cache',
	normalizeUnit,
	model: Question,
	getRecentTopics,
	serveCached: async (doc) => ({
		answer: hotPoolBodyFromDoc(doc),
		provider: 'cache',
		model: 'cached',
		cached: true,
		questionId: doc.s3QuestionId
	}),
	generateLive: async (className, unit, recentTopics) => {
		const result = await generateQuestionForPool(className, unit, recentTopics ?? []);
		return { ...result, cached: false };
	},
	getLiveTiming: (result) => result.timing
});

export const getQuestion = mcqPool.getQuestion;
