import { Question, newPoolRandomKey, type IQuestion } from '$lib/questions/cache-model.server';
import {
	generateAPQuestion,
	persistParsedMcqToS3,
	type APQuestionData,
	type GenerateResult
} from '$lib/questions/generation.server';
import { logger } from '$lib/server/logger';
import { getRecentTopics, recordRecentTopic } from '$lib/questions/recent-topic.server';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';
import { QuestionGenerationError } from '$lib/questions/question-errors.server';

/** Build an active-library pool document with the full MCQ body inline. */
export function buildHotPoolDoc(opts: {
	s3QuestionId: string;
	apClass: string;
	unit: string;
	contentHash: string;
	answer: APQuestionData;
	randomKey?: number;
	active?: boolean;
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
	| 'randomKey'
	| 'active'
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
		hint2: answer.hint2,
		randomKey: opts.randomKey ?? newPoolRandomKey(),
		active: opts.active ?? true
	};
}

export async function insertHotPoolDoc(
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

/**
 * Worker-only: AI → S3 → Mongo active library.
 * Must not be imported by request-path selection modules.
 */
export async function generateQuestionForPool(
	className: string,
	unit: string,
	recentTopics: string[] = []
): Promise<GenerateResult & { skippedDuplicate?: boolean }> {
	const cacheUnit = normalizeUnit(unit);
	const topics = recentTopics.length
		? recentTopics
		: await getRecentTopics(className, cacheUnit).catch(() => []);
	const result = await generateAPQuestion({ className, unit, recentTopics: topics });
	const { answer, questionId } = result;
	if (!questionId) {
		throw new QuestionGenerationError('Generated question was not persisted to S3');
	}

	return insertGeneratedQuestionIntoPool({
		className,
		unit: cacheUnit,
		answer,
		questionId,
		generationMs: result.timing?.generationMs ?? 0,
		result
	});
}

/** Persist a batch/sync-parsed MCQ into S3 + Mongo (worker/batch collect only). */
export async function persistParsedQuestionToPool(
	className: string,
	unit: string,
	answer: APQuestionData
): Promise<{ questionId: string; skippedDuplicate?: boolean }> {
	const cacheUnit = normalizeUnit(unit);
	const questionId = await persistParsedMcqToS3(answer, className, unit);
	const inserted = await insertGeneratedQuestionIntoPool({
		className,
		unit: cacheUnit,
		answer,
		questionId,
		generationMs: 0,
		result: {
			answer,
			provider: 'ai',
			model: 'batch',
			questionId
		}
	});
	return {
		questionId,
		skippedDuplicate: inserted.skippedDuplicate
	};
}

async function insertGeneratedQuestionIntoPool(opts: {
	className: string;
	unit: string;
	answer: APQuestionData;
	questionId: string;
	generationMs: number;
	result: GenerateResult;
}): Promise<GenerateResult & { skippedDuplicate?: boolean }> {
	const contentHash = computeContentHash(opts.answer.question);
	const poolInsertStarted = Date.now();
	try {
		await insertHotPoolDoc(opts.className, opts.unit, opts.answer, opts.questionId);
	} catch (err: unknown) {
		if (isDuplicateKeyError(err)) {
			logger.info('[pool-write] duplicate key on pool insert, skipping', {
				className: opts.className,
				unit: opts.unit,
				contentHash
			});
			return {
				...opts.result,
				skippedDuplicate: true,
				timing: {
					generationMs: opts.generationMs,
					persistenceMs: Date.now() - poolInsertStarted
				}
			};
		}
		throw err;
	}

	return {
		...opts.result,
		timing: {
			generationMs: opts.generationMs,
			persistenceMs: Date.now() - poolInsertStarted
		}
	};
}
