import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
	createCanonicalMcqQuestion,
	newPoolRandomKey,
	type IQuestion
} from '$lib/question-bank/mcq/repository.server';
import {
	generateAPQuestion,
	generateAPStimulusSet,
	parseGeneratedApStimulusSet,
	type APStimulusSetData,
	type APQuestionData,
	type GenerateResult,
	type GenerateStimulusSetResult
} from '$lib/question-bank/mcq/generation.server';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';
import { logger } from '$lib/server/logger';
import { getRecentTopics } from '$lib/question-bank/recent-topic.server';
import {
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit
} from '$lib/question-bank/util.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit
} from '$lib/question-bank/mcq/stimulus-policy';
import { isStimulusQuestionsEnabled } from '$lib/flags';

export class QuestionGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QuestionGenerationError';
	}
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(',')}}`;
}

function stimulusChildHash(
	stimulus: { text: string | null; diagramSpec: Record<string, unknown> | null },
	child: APStimulusSetData['questions'][number]
): string {
	return computeContentHash(
		stableStringify({
			stimulus,
			question: child.question,
			optionA: child.optionA,
			optionB: child.optionB,
			optionC: child.optionC,
			optionD: child.optionD,
			correctAnswer: child.correctAnswer
		})
	);
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
	const policy = getStimulusPolicy(className);
	const diagramsEnabled =
		(await isStimulusQuestionsEnabled()) &&
		policy.allowDiscreteDiagrams &&
		isStimulusPolicyEnabledForUnit(policy, cacheUnit);
	const result = await generateAPQuestion({
		className,
		unit,
		recentTopics: topics,
		diagramsEnabled
	});
	if (result.answer.diagram) {
		const allowed = policy.profiles.some((profile) =>
			profile.diagramTypes.includes(String(result.answer.diagram?.type ?? ''))
		);
		if (!allowed)
			throw new QuestionGenerationError('Generated diagram is not allowed for this course/unit.');
	}
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

export async function generateStimulusSetForPool(opts: {
	className: string;
	unit: string;
	childCount: number;
	mode: 'text' | 'diagram' | 'mixed';
	recentTopics?: string[];
}): Promise<GenerateStimulusSetResult & { skippedDuplicate?: boolean; questionIds: string[] }> {
	const cacheUnit = normalizeUnit(opts.unit);
	const policy = getStimulusPolicy(opts.className);
	if (
		!(await isStimulusQuestionsEnabled()) ||
		!policy.setsEnabled ||
		!isStimulusPolicyEnabledForUnit(policy, cacheUnit)
	) {
		throw new QuestionGenerationError(
			'Stimulus question generation is disabled for this course/unit.'
		);
	}
	const profile = policy.profiles[0];
	if (
		!profile ||
		!profile.allowedModes.includes(opts.mode) ||
		opts.childCount < profile.minChildren ||
		opts.childCount > profile.maxChildren
	) {
		throw new QuestionGenerationError('Stimulus set does not match the course/unit policy.');
	}
	const topics = opts.recentTopics?.length
		? opts.recentTopics
		: await getRecentTopics({ kind: 'mcq', apClass: opts.className, unit: cacheUnit }).catch(
				() => []
			);
	const generated = await generateAPStimulusSet({ ...opts, recentTopics: topics });
	if (generated.answer.diagram) {
		const diagramType = String(generated.answer.diagram.type ?? '');
		if (!profile.diagramTypes.includes(diagramType)) {
			throw new QuestionGenerationError(
				'Generated stimulus diagram is not allowed for this course/unit.'
			);
		}
	}
	const persisted = await persistStimulusSetToPool(opts.className, cacheUnit, generated.answer);
	return { ...generated, ...persisted };
}

/** Persist a batch/sync-parsed MCQ into Neon (worker/batch collect only). */
export async function persistParsedQuestionToPool(
	className: string,
	unit: string,
	answer: APQuestionData
): Promise<{ questionId: string; skippedDuplicate?: boolean }> {
	const cacheUnit = normalizeUnit(unit);
	if (answer.diagram) {
		const policy = getStimulusPolicy(className);
		const allowed =
			(await isStimulusQuestionsEnabled()) &&
			policy.allowDiscreteDiagrams &&
			isStimulusPolicyEnabledForUnit(policy, cacheUnit) &&
			policy.profiles.some((profile) =>
				profile.diagramTypes.includes(String(answer.diagram?.type ?? ''))
			);
		if (!allowed) {
			throw new QuestionGenerationError('Generated diagram is not allowed for this course/unit.');
		}
	}
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

/** Persist every child of one validated stimulus set atomically. */
export async function persistStimulusSetToPool(
	className: string,
	unit: string,
	input: APStimulusSetData & { diagram: Record<string, unknown> | null }
): Promise<{ questionIds: string[]; skippedDuplicate?: boolean }> {
	const parsed = parseGeneratedApStimulusSet(input, input.questions.length);
	const stimulusId = randomUUID();
	const stimulus = {
		text: parsed.stimulus.text,
		diagramSpec: parsed.diagram,
		provenance: 'ai-generated-original' as const
	};
	const count = parsed.questions.length;
	const rows = parsed.questions.map((child, index) => {
		const questionId = randomUUID();
		const topicsCovered = child.topicsCovered.trim();
		const mainTopic = resolveQuestionMainTopic(child.mainTopic, topicsCovered) || 'Generated topic';
		return {
			questionId,
			className,
			unit,
			contentHash: stimulusChildHash(stimulus, child),
			contentLength: child.question.length,
			topicsId: randomUUID(),
			topicsCovered,
			data: {
				apClass: className,
				unit,
				mainTopic,
				topicsCovered,
				question: child.question,
				diagramSpec: null,
				hasDiagram: Boolean(parsed.diagram),
				optionA: child.optionA,
				optionB: child.optionB,
				optionC: child.optionC,
				optionD: child.optionD,
				correctAnswer: child.correctAnswer,
				explanation: child.explanation,
				stimulus,
				stimulusId,
				stimulusPosition: index,
				stimulusQuestionCount: count
			}
		};
	});

	try {
		const result = await getNeonDatabase().execute(sql`
			WITH input AS (
				SELECT
					item->>'questionId' AS question_id,
					item->>'className' AS ap_class,
					item->>'unit' AS unit,
					item->>'contentHash' AS content_hash,
					(item->>'contentLength')::int AS content_length,
					item->'data' AS data,
					item->>'topicsId' AS topics_id,
					item->>'topicsCovered' AS topics_covered
				FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS source(item)
			), registry_rows AS (
				INSERT INTO content.question_registry
					(question_id, kind, ap_class, unit, content_hash, content_length)
				SELECT question_id, 'mcq', ap_class, unit, content_hash, content_length
				FROM input
				RETURNING question_id
			), question_rows AS (
				INSERT INTO content.mcq_questions
					(question_id, data, content_hash, random_key, active)
				SELECT input.question_id, input.data, input.content_hash, random(), true
				FROM input
				JOIN registry_rows ON registry_rows.question_id = input.question_id
				RETURNING question_id
			), topic_rows AS (
				INSERT INTO content.question_recent_topics
					(id, kind, ap_class, unit, topics_covered, question_id)
				SELECT topics_id, 'mcq', ap_class, unit, topics_covered, question_id
				FROM input
				WHERE topics_covered <> ''
			)
			SELECT question_id FROM question_rows
		`);
		const insertedIds = (result.rows as Array<{ question_id?: string }>)
			.map((row) => row.question_id)
			.filter((id): id is string => Boolean(id));
		if (insertedIds.length !== rows.length)
			throw new Error('Atomic stimulus-set insert returned an unexpected child count.');
		return { questionIds: insertedIds };
	} catch (error) {
		if (isDuplicateKeyError(error)) return { questionIds: [], skippedDuplicate: true };
		throw error;
	}
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
