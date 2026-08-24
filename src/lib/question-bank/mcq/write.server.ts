import { randomUUID } from 'node:crypto';
import {
	createCanonicalMcqQuestion,
	newPoolRandomKey,
	type IQuestion
} from '$lib/question-bank/mcq/repository.server';
import {
	generateAPQuestion,
	type APQuestionData,
	type GenerateResult
} from '$lib/question-bank/mcq/generation.server';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';
import { logger } from '$lib/server/logger';
import { getRecentTopics } from '$lib/question-bank/recent-topic.server';
import {
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit
} from '$lib/question-bank/util.server';

export class QuestionGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QuestionGenerationError';
	}
}

/** Build an active-library pool document with the full MCQ body inline. */
function buildHotPoolDoc(opts: {
	questionId: string;
	apClass: string;
	unit: string;
	contentHash: string;
	answer: APQuestionData;
	randomKey?: number;
	active?: boolean;
}): Pick<
	IQuestion,
	| 'questionId'
	| 'apClass'
	| 'unit'
	| 'mainTopic'
	| 'contentHash'
	| 'topicsCovered'
	| 'question'
	| 'diagramSpec'
	| 'hasDiagram'
	| 'optionA'
	| 'optionB'
	| 'optionC'
	| 'optionD'
	| 'correctAnswer'
	| 'explanation'
	| 'randomKey'
	| 'active'
> {
	const { answer } = opts;
	return {
		questionId: opts.questionId,
		apClass: opts.apClass,
		unit: opts.unit,
		contentHash: opts.contentHash,
		mainTopic: answer.mainTopic,
		topicsCovered: answer.topicsCovered ?? '',
		question: answer.question,
		diagramSpec: answer.diagram ?? null,
		hasDiagram: Boolean(answer.diagram),
		optionA: answer.optionA,
		optionB: answer.optionB,
		optionC: answer.optionC,
		optionD: answer.optionD,
		correctAnswer: answer.correctAnswer,
		explanation: answer.explanation,
		randomKey: opts.randomKey ?? newPoolRandomKey(),
		active: opts.active ?? true
	};
}

async function insertHotPoolDoc(
	className: string,
	cacheUnit: string,
	answer: APQuestionData,
	questionId: string
): Promise<IQuestion> {
	if (answer.diagram) {
		const validation = validateExamfigDiagram(answer.diagram);
		if (!validation.valid) {
			throw new Error(
				`Generated examfig diagram failed validation: ${validation.errors.join('; ')}`
			);
		}
	}
	return createCanonicalMcqQuestion(
		buildHotPoolDoc({
			apClass: className,
			unit: cacheUnit,
			contentHash: computeContentHash(answer.question),
			answer,
			questionId
		})
	);
}

/**
 * Worker-only: AI → Neon PostgreSQL active library.
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
		: await getRecentTopics({ kind: 'mcq', apClass: className, unit: cacheUnit }).catch(() => []);
	const result = await generateAPQuestion({ className, unit, recentTopics: topics });
	const { answer, questionId } = result;
	if (!questionId) {
		throw new QuestionGenerationError('Generated question did not receive an id');
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

/** Persist a batch/sync-parsed MCQ into Neon (worker/batch collect only). */
export async function persistParsedQuestionToPool(
	className: string,
	unit: string,
	answer: APQuestionData
): Promise<{ questionId: string; skippedDuplicate?: boolean }> {
	const cacheUnit = normalizeUnit(unit);
	const questionId = randomUUID();
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
