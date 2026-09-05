import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lt, not, notInArray, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	mcqQuestions,
	questionRecentTopics,
	questionRegistry,
	type McqQuestionPayload
} from '$lib/server/neon/schema';
import { questionBucketFields } from '$lib/server/neon/jsonb';
import { parseMcqQuestionPayload } from '$lib/question-bank/mcq/payload-schema';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';

export interface IQuestion extends McqQuestionPayload {
	questionId: string;
	randomKey: number;
	active: boolean;
	contentHash: string;
	createdAt: Date;
	updatedAt: Date;
}

const { apClass: apClassField, unit: unitField } = questionBucketFields(mcqQuestions.data);

export type McqSelectionContext = { allowEnhanced: boolean };

const enhancedContentPredicate = sql`(
	jsonb_typeof(${mcqQuestions.data}->'stimulus') = 'object'
	OR jsonb_typeof(${mcqQuestions.data}->'diagramSpec') = 'object'
	OR ${mcqQuestions.data}->>'hasDiagram' = 'true'
)`;

/** The narrow row shape used by the anonymous pool-hit path. */
export type McqPoolQuestion = McqQuestionPayload & {
	questionId: string;
	randomKey: number;
	active: boolean;
	apClass: string;
	unit: string;
};

const jsonText = (field: string) => sql<string | null>`${mcqQuestions.data} ->> ${field}`;

const poolQuestionSelection = {
	questionId: mcqQuestions.questionId,
	randomKey: mcqQuestions.randomKey,
	active: mcqQuestions.active,
	apClass: sql<string>`COALESCE(NULLIF(${jsonText('apClass')}, ''), 'Unknown')`,
	unit: sql<string>`COALESCE(NULLIF(${jsonText('unit')}, ''), 'all-units')`,
	mainTopic: sql<string>`COALESCE(NULLIF(${jsonText('mainTopic')}, ''), NULLIF(${jsonText('topicsCovered')}, ''), 'Legacy topic')`,
	topicsCovered: sql<string>`COALESCE(${jsonText('topicsCovered')}, '')`,
	question: sql<string>`COALESCE(${jsonText('question')}, ${jsonText('prompt')}, '')`,
	optionA: sql<string>`COALESCE(${jsonText('optionA')}, ${mcqQuestions.data} -> 'options' -> 0 ->> 'text', ${mcqQuestions.data} -> 'options' -> 0 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 0, '')`,
	optionB: sql<string>`COALESCE(${jsonText('optionB')}, ${mcqQuestions.data} -> 'options' -> 1 ->> 'text', ${mcqQuestions.data} -> 'options' -> 1 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 1, '')`,
	optionC: sql<string>`COALESCE(${jsonText('optionC')}, ${mcqQuestions.data} -> 'options' -> 2 ->> 'text', ${mcqQuestions.data} -> 'options' -> 2 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 2, '')`,
	optionD: sql<string>`COALESCE(${jsonText('optionD')}, ${mcqQuestions.data} -> 'options' -> 3 ->> 'text', ${mcqQuestions.data} -> 'options' -> 3 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 3, '')`,
	correctAnswer: sql<string>`COALESCE(${jsonText('correctAnswer')}, ${jsonText('answer')}, '')`,
	explanation: sql<string>`COALESCE(${jsonText('explanation')}, ${jsonText('rationale')}, '')`,
	diagramSpec: sql<Record<
		string,
		unknown
	> | null>`COALESCE(${mcqQuestions.data} -> 'diagramSpec', ${mcqQuestions.data} -> 'diagram')`,
	hasDiagram: sql<boolean>`CASE WHEN ${jsonText('hasDiagram')} = 'true' THEN true WHEN ${jsonText('hasDiagram')} = 'false' THEN false ELSE ${mcqQuestions.data} -> 'diagramSpec' IS NOT NULL OR ${mcqQuestions.data} -> 'diagram' IS NOT NULL END`,
	stimulus: sql<unknown>`${mcqQuestions.data} -> 'stimulus'`,
	stimulusId: jsonText('stimulusId'),
	stimulusPosition: jsonText('stimulusPosition'),
	stimulusQuestionCount: jsonText('stimulusQuestionCount')
};

function normalizePoolCorrectAnswer(value: string): 'A' | 'B' | 'C' | 'D' {
	const upper = value.trim().toUpperCase();
	if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper;
	const match = upper.match(/\b([A-D])\b/);
	if (match?.[1] === 'A' || match?.[1] === 'B' || match?.[1] === 'C' || match?.[1] === 'D') {
		return match[1];
	}
	throw new Error('Stored MCQ has an invalid answer key');
}

function normalizePoolDiagramSpec(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function normalizePoolStimulus(value: unknown): McqQuestionPayload['stimulus'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const candidate = value as Record<string, unknown>;
	const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
	const diagramSpec = normalizePoolDiagramSpec(candidate.diagramSpec ?? candidate.diagram);
	if (!text && !diagramSpec) return null;
	return {
		text: text || null,
		diagramSpec,
		provenance:
			candidate.provenance === 'ai-generated-original' ? 'ai-generated-original' : 'legacy-unknown'
	};
}

function normalizePoolUuid(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePoolInt(value: unknown, minimum = 0): number | null {
	if (typeof value === 'number' && Number.isInteger(value) && value >= minimum) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		if (Number.isInteger(parsed) && parsed >= minimum) return parsed;
	}
	return null;
}

type McqPoolQuestionRow = Omit<
	McqPoolQuestion,
	| 'correctAnswer'
	| 'diagramSpec'
	| 'stimulus'
	| 'stimulusId'
	| 'stimulusPosition'
	| 'stimulusQuestionCount'
> & {
	correctAnswer: string;
	diagramSpec: unknown;
	stimulus: unknown;
	stimulusId: string | null;
	stimulusPosition: string | null;
	stimulusQuestionCount: string | null;
};

function poolQuestionFromRow(row: McqPoolQuestionRow): McqPoolQuestion {
	const diagramSpec = normalizePoolDiagramSpec(row.diagramSpec);
	const stimulus = normalizePoolStimulus(row.stimulus);
	return {
		...row,
		mainTopic: row.mainTopic.trim() || row.topicsCovered.trim() || 'Legacy topic',
		topicsCovered: row.topicsCovered.trim(),
		question: row.question.trim(),
		optionA: row.optionA.trim(),
		optionB: row.optionB.trim(),
		optionC: row.optionC.trim(),
		optionD: row.optionD.trim(),
		correctAnswer: normalizePoolCorrectAnswer(row.correctAnswer),
		explanation: row.explanation.trim(),
		diagramSpec,
		hasDiagram: row.hasDiagram || Boolean(diagramSpec) || Boolean(stimulus?.diagramSpec),
		stimulus,
		stimulusId: normalizePoolUuid(row.stimulusId),
		stimulusPosition: normalizePoolInt(row.stimulusPosition),
		stimulusQuestionCount: normalizePoolInt(row.stimulusQuestionCount, 1)
	};
}

function poolLookupPredicates(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	context?: McqSelectionContext;
}) {
	const predicates = [
		eq(apClassField, input.apClass),
		eq(unitField, input.unit),
		eq(mcqQuestions.active, true),
		input.fromPivot === 'after'
			? gte(mcqQuestions.randomKey, input.pivot)
			: lt(mcqQuestions.randomKey, input.pivot)
	];
	if (input.context && !input.context.allowEnhanced) {
		predicates.push(not(enhancedContentPredicate));
	}
	if (input.excludeQuestionIds.length) {
		predicates.push(notInArray(mcqQuestions.questionId, input.excludeQuestionIds));
	}
	return predicates;
}

export type CanonicalMcqInput = Omit<
	IQuestion,
	| 'unit'
	| 'randomKey'
	| 'active'
	| 'hasDiagram'
	| 'diagramSpec'
	| 'stimulus'
	| 'stimulusId'
	| 'stimulusPosition'
	| 'stimulusQuestionCount'
	| 'mainTopic'
	| 'topicsCovered'
	| 'createdAt'
	| 'updatedAt'
> &
	Partial<
		Pick<
			IQuestion,
			| 'unit'
			| 'randomKey'
			| 'active'
			| 'hasDiagram'
			| 'diagramSpec'
			| 'mainTopic'
			| 'topicsCovered'
			| 'stimulus'
			| 'stimulusId'
			| 'stimulusPosition'
			| 'stimulusQuestionCount'
		>
	>;

export function newPoolRandomKey(): number {
	return Math.random();
}

export async function countActiveMcqQuestions(
	apClass: string,
	unit: string,
	context: McqSelectionContext = { allowEnhanced: true }
): Promise<number> {
	const predicates = [
		eq(apClassField, apClass),
		eq(unitField, unit),
		eq(mcqQuestions.active, true)
	];
	if (!context.allowEnhanced) predicates.push(not(enhancedContentPredicate));
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(mcqQuestions)
		.where(and(...predicates));
	return Number(row?.count ?? 0);
}

function fromRow(row: typeof mcqQuestions.$inferSelect): IQuestion {
	const { data, ...metadata } = row;
	return { ...parseMcqQuestionPayload(data), ...metadata };
}

/** Insert a generated MCQ and its serving metadata in one Neon batch. */
export async function createCanonicalMcqQuestion(input: CanonicalMcqInput): Promise<IQuestion> {
	const questionId = input.questionId.trim();
	if (!questionId) throw new Error('MCQ question requires questionId');

	const unit = input.unit ?? 'all-units';
	const topicsCovered = input.topicsCovered?.trim() ?? '';
	const mainTopic = resolveQuestionMainTopic(input.mainTopic, topicsCovered) || 'Legacy topic';
	const data: McqQuestionPayload = {
		apClass: input.apClass,
		unit,
		mainTopic,
		topicsCovered,
		question: input.question,
		diagramSpec: input.diagramSpec ?? null,
		hasDiagram: input.hasDiagram ?? Boolean(input.diagramSpec),
		optionA: input.optionA,
		optionB: input.optionB,
		optionC: input.optionC,
		optionD: input.optionD,
		correctAnswer: input.correctAnswer,
		explanation: input.explanation,
		stimulus: input.stimulus ?? null,
		stimulusId: input.stimulusId ?? null,
		stimulusPosition: input.stimulusPosition ?? null,
		stimulusQuestionCount: input.stimulusQuestionCount ?? null
	};
	const db = getNeonDatabase();
	const registryInsert = db
		.insert(questionRegistry)
		.values({
			questionId,
			kind: 'mcq',
			apClass: input.apClass,
			unit,
			contentHash: input.contentHash,
			contentLength: input.question.length
		})
		.onConflictDoUpdate({
			target: questionRegistry.questionId,
			set: {
				kind: 'mcq',
				apClass: input.apClass,
				unit,
				contentHash: input.contentHash,
				contentLength: input.question.length
			}
		});
	const mcqInsert = db
		.insert(mcqQuestions)
		.values({
			questionId,
			data,
			contentHash: input.contentHash,
			randomKey: input.randomKey ?? newPoolRandomKey(),
			active: input.active ?? true
		})
		.returning();
	const recentTopicInsert = topicsCovered
		? db.insert(questionRecentTopics).values({
				id: randomUUID(),
				kind: 'mcq',
				apClass: input.apClass,
				unit,
				topicsCovered,
				questionId
			})
		: null;

	const results = recentTopicInsert
		? await db.batch([registryInsert, mcqInsert, recentTopicInsert])
		: await db.batch([registryInsert, mcqInsert]);
	const row = (results[1] as Array<typeof mcqQuestions.$inferSelect>)[0];
	if (!row) throw new Error('PostgreSQL MCQ insert returned no row');
	return fromRow(row);
}

export async function findCachedQuestionByPool(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
	context?: McqSelectionContext;
}): Promise<McqPoolQuestion | null> {
	const db = getNeonDatabase(input.onDatabaseInit);
	const rows = await db
		.select(poolQuestionSelection)
		.from(mcqQuestions)
		.where(and(...poolLookupPredicates(input)))
		.orderBy(mcqQuestions.randomKey)
		.limit(1);
	return rows[0] ? poolQuestionFromRow(rows[0]) : null;
}

/** Select a batch around one random pivot in a single Neon HTTP batch. */
export async function findCachedQuestionsByPool(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	limit: number;
	onDatabaseInit?: (elapsedMs: number) => void;
	context?: McqSelectionContext;
}): Promise<McqPoolQuestion[]> {
	const db = getNeonDatabase(input.onDatabaseInit);
	const createQuery = (fromPivot: 'after' | 'before') =>
		db
			.select(poolQuestionSelection)
			.from(mcqQuestions)
			.where(
				and(
					...poolLookupPredicates({
						apClass: input.apClass,
						unit: input.unit,
						excludeQuestionIds: input.excludeQuestionIds,
						pivot: input.pivot,
						fromPivot,
						context: input.context
					})
				)
			)
			.orderBy(mcqQuestions.randomKey)
			.limit(input.limit);

	const [afterRows, beforeRows] = await db.batch([createQuery('after'), createQuery('before')]);
	return [...afterRows, ...beforeRows]
		.slice(0, input.limit)
		.map((row) => poolQuestionFromRow(row as McqPoolQuestionRow));
}

export async function findCachedQuestion(questionId: string): Promise<IQuestion | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(mcqQuestions)
		.where(eq(mcqQuestions.questionId, questionId))
		.limit(1);
	return rows[0] ? fromRow(rows[0]) : null;
}

export async function findCachedQuestions(questionIds: string[]): Promise<IQuestion[]> {
	if (!questionIds.length) return [];
	const rows = await getNeonDatabase()
		.select()
		.from(mcqQuestions)
		.where(inArray(mcqQuestions.questionId, questionIds));
	return rows.map(fromRow);
}

export async function findAllCachedQuestions(): Promise<IQuestion[]> {
	const rows = await getNeonDatabase().select().from(mcqQuestions);
	return rows.map(fromRow);
}

/** Load active MCQs for quiz assembly across one or more real units. */
export async function findActiveQuestionsForQuiz(input: {
	apClass: string;
	units: string[];
}): Promise<IQuestion[]> {
	const units = [...new Set(input.units.map((unit) => unit.trim()).filter(Boolean))];
	if (!units.length) return [];
	const rows = await getNeonDatabase()
		.select()
		.from(mcqQuestions)
		.where(
			and(
				eq(mcqQuestions.active, true),
				eq(apClassField, input.apClass),
				inArray(unitField, units),
				// A finalized bad child is excluded. A stimulus/set failure excludes
				// every child that carries the same server-assigned stimulus ID.
				sql`not exists (
					select 1
					from content.question_quality own_quality
					where own_quality.question_id = ${mcqQuestions.questionId}
					  and own_quality.final_verdict = 'bad'
				)
				and (
					${mcqQuestions.data}->>'stimulusId' is null
					or not exists (
						select 1
						from content.question_quality shared_quality
						join content.mcq_questions shared_question
						  on shared_question.question_id = shared_quality.question_id
						where shared_quality.final_verdict = 'bad'
						  and coalesce(
							shared_quality.ai_assessment->>'failure_scope',
							shared_quality.ai_assessment->>'failureScope'
						  ) in ('stimulus', 'set')
						  and shared_question.data->>'stimulusId' = ${mcqQuestions.data}->>'stimulusId'
					)
				)`
			)
		);
	return rows.map(fromRow);
}

export interface StoredQuestion {
	id: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	apClass?: string;
	unit?: string;
	mainTopic?: string;
	contentHash?: string;
	topicsCovered?: string;
	diagramSpec?: Record<string, unknown>;
	hasDiagram: boolean;
	stimulus?: McqQuestionPayload['stimulus'];
	stimulusId?: string | null;
	stimulusPosition?: number | null;
	stimulusQuestionCount?: number | null;
	createdAt: string;
}

export function storedQuestionFromPayload(input: {
	questionId: string;
	data: McqQuestionPayload;
	contentHash?: string | null;
	createdAt: Date;
}): StoredQuestion {
	const { data } = input;
	return {
		id: input.questionId,
		question: data.question,
		optionA: data.optionA,
		optionB: data.optionB,
		optionC: data.optionC,
		optionD: data.optionD,
		correctAnswer: data.correctAnswer,
		explanation: data.explanation,
		apClass: data.apClass,
		unit: data.unit,
		mainTopic: data.mainTopic,
		...(input.contentHash ? { contentHash: input.contentHash } : {}),
		...(data.topicsCovered?.trim() ? { topicsCovered: data.topicsCovered } : {}),
		...(data.diagramSpec ? { diagramSpec: data.diagramSpec } : {}),
		hasDiagram: data.hasDiagram ?? Boolean(data.diagramSpec),
		...(data.stimulus ? { stimulus: data.stimulus } : {}),
		...(data.stimulusId ? { stimulusId: data.stimulusId } : {}),
		...(data.stimulusPosition !== null && data.stimulusPosition !== undefined
			? { stimulusPosition: data.stimulusPosition }
			: {}),
		...(data.stimulusQuestionCount !== null && data.stimulusQuestionCount !== undefined
			? { stimulusQuestionCount: data.stimulusQuestionCount }
			: {}),
		createdAt: input.createdAt.toISOString()
	};
}

function toStoredQuestion(question: IQuestion): StoredQuestion {
	return storedQuestionFromPayload({
		questionId: question.questionId,
		data: question,
		contentHash: question.contentHash,
		createdAt: question.createdAt
	});
}

/** Resolve an MCQ body from its canonical Neon row. */
export async function getQuestionById(questionId: string): Promise<StoredQuestion> {
	const normalizedId = questionId.trim();
	if (!normalizedId) throw new Error('Question id is required');

	const question = await findCachedQuestion(normalizedId);
	if (!question) throw new Error(`Question not found: ${normalizedId}`);
	return toStoredQuestion(question);
}

/** Build a lookup map from canonical Neon MCQ rows. */
export async function getQuestionsLookupMap(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	const map = new Map<string, StoredQuestion>();
	if (uniqueIds.length === 0) return map;

	const questions = await findCachedQuestions(uniqueIds);
	for (const question of questions) {
		const stored = toStoredQuestion(question);
		map.set(stored.id, stored);
	}
	return map;
}

export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	if (uniqueIds.length === 0) return [];

	const map = await getQuestionsLookupMap(uniqueIds);
	return uniqueIds.map((id) => map.get(id)).filter((q): q is StoredQuestion => q !== undefined);
}

/** List all canonical MCQs for maintenance and quality tooling. */
export async function getAllQuestions(): Promise<StoredQuestion[]> {
	const questions = await findAllCachedQuestions();
	return questions.map(toStoredQuestion);
}
