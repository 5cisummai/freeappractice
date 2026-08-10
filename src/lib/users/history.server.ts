import type { IQuestionAttempt } from '$lib/users/records.server';
import type { FrqHistoryItem, HistorySummary } from '$lib/users/types';
import type { StoredQuestion } from '$lib/questions/storage.server';
import { inArray, sql, type SQL } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqAttemptGrades, frqAttempts, mcqAttempts, mcqQuestions } from '$lib/server/neon/schema';

type McqHistoryItem = {
	kind: 'mcq';
	attempt: IQuestionAttempt;
	question: StoredQuestion | null;
};

type PracticeHistoryItem = McqHistoryItem | FrqHistoryItem;

type PracticeHistoryPageResult = {
	items: PracticeHistoryItem[];
	total: number;
	page: number;
	limit: number;
	summary: HistorySummary;
};

export type HistoryResultFilter = 'correct' | 'incorrect';
export type HistoryKindFilter = 'mcq' | 'frq';

export type HistoryFilters = {
	unit?: string;
	result?: HistoryResultFilter;
	kind?: HistoryKindFilter;
	from?: string;
	to?: string;
};

const FRQ_PASS_THRESHOLD = 70;

type HistoryQueryOptions = {
	page: number;
	limit: number;
	apClass?: string;
	search?: string;
	sort?: HistorySort;
	filters?: HistoryFilters;
	/** Feature/configuration gate for the FRQ source. Defaults to enabled. */
	includeFrq?: boolean;
};

type McqHistoryRow = {
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer: string | null;
	wasCorrect: boolean | null;
	timeTakenMs: number | null;
	attemptedAt: Date;
	finalAnswer: string | null;
	answerCount: number | null;
	hintsShown: number | null;
	terminalOutcome: string | null;
	experimentKey: string | null;
	experimentVersion: number | null;
	displayedVariant: string | null;
};

type HistorySqlRow = McqHistoryRow & {
	kind: 'mcq' | 'frq';
	id: string;
	pointsEarned: number | null;
	pointsAvailable: number | null;
	percentage: number | null;
	resultScore: number;
};

type HistorySummaryRow = {
	total: number;
	answered: number;
	correct: number;
	graded: number;
	avgTimeMs: number | null;
};

export function parseHistoryResult(
	value: string | null | undefined
): HistoryResultFilter | undefined {
	return value === 'correct' || value === 'incorrect' ? value : undefined;
}

export function parseHistoryKind(value: string | null | undefined): HistoryKindFilter | undefined {
	return value === 'mcq' || value === 'frq' ? value : undefined;
}

function parseHistoryDate(value: string | null | undefined, endOfDay = false): number | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		date.setUTCHours(23, 59, 59, 999);
	}
	const time = date.getTime();
	return Number.isNaN(time) ? undefined : time;
}

type HistorySort = {
	field: 'attemptedAt' | 'subject' | 'result';
	direction: 'asc' | 'desc';
};

const SORT_FIELDS = new Set<HistorySort['field']>(['attemptedAt', 'subject', 'result']);

export function parseHistorySort(
	sortBy: string | null | undefined,
	sortDir: string | null | undefined
): HistorySort {
	return {
		field: SORT_FIELDS.has(sortBy as HistorySort['field'])
			? (sortBy as HistorySort['field'])
			: 'attemptedAt',
		direction: sortDir === 'asc' ? 'asc' : 'desc'
	};
}

export async function hydrateMcqHistoryItems(items: McqHistoryItem[]): Promise<McqHistoryItem[]> {
	const uniqueIds = [...new Set(items.map((item) => item.attempt.questionId))];
	if (uniqueIds.length === 0) return items;

	const db = getNeonDatabase();
	const rows = await db
		.select({
			id: mcqQuestions.questionId,
			question: mcqQuestions.question,
			optionA: mcqQuestions.optionA,
			optionB: mcqQuestions.optionB,
			optionC: mcqQuestions.optionC,
			optionD: mcqQuestions.optionD,
			correctAnswer: mcqQuestions.correctAnswer,
			explanation: mcqQuestions.explanation,
			hint1: mcqQuestions.hint1,
			hint2: mcqQuestions.hint2,
			apClass: mcqQuestions.apClass,
			unit: mcqQuestions.unit,
			contentHash: mcqQuestions.contentHash,
			topicsCovered: mcqQuestions.topicsCovered,
			createdAt: mcqQuestions.createdAt
		})
		.from(mcqQuestions)
		.where(inArray(mcqQuestions.questionId, uniqueIds));
	const lookup = new Map<string, StoredQuestion>(
		rows.map((row) => [
			row.id,
			{
				id: row.id,
				question: row.question,
				optionA: row.optionA,
				optionB: row.optionB,
				optionC: row.optionC,
				optionD: row.optionD,
				explanation: row.explanation,
				correctAnswer: row.correctAnswer as StoredQuestion['correctAnswer'],
				createdAt: row.createdAt.toISOString(),
				...(row.hint1 !== null ? { hint1: row.hint1 } : {}),
				...(row.hint2 !== null ? { hint2: row.hint2 } : {}),
				...(row.apClass !== null ? { apClass: row.apClass } : {}),
				...(row.unit !== null ? { unit: row.unit } : {}),
				...(row.contentHash !== null ? { contentHash: row.contentHash } : {}),
				...(row.topicsCovered !== null ? { topicsCovered: row.topicsCovered } : {})
			}
		])
	);

	return items.map((item) => ({
		kind: 'mcq' as const,
		attempt: item.attempt,
		question: lookup.get(item.attempt.questionId) ?? null
	}));
}

export async function getPracticeHistoryPage(
	userId: string,
	options: HistoryQueryOptions
): Promise<PracticeHistoryPageResult> {
	const {
		page,
		limit,
		apClass,
		search,
		sort = { field: 'attemptedAt', direction: 'desc' },
		filters = {},
		includeFrq = true
	} = options;
	if (!includeFrq && filters.kind === 'frq') {
		return {
			items: [],
			total: 0,
			page,
			limit,
			summary: { total: 0, answered: 0, correct: 0, accuracy: null, avgTimeMs: null }
		};
	}

	const db = getNeonDatabase();
	const from = parseHistoryDate(filters.from);
	const to = parseHistoryDate(filters.to, true);
	const searchText = search?.trim();
	const commonConditions = (columns: {
		userId: unknown;
		apClass: unknown;
		unit: unknown;
		attemptedAt: unknown;
	}): SQL[] => [
		sql`${columns.userId} = ${userId}`,
		...(apClass ? [sql`${columns.apClass} = ${apClass}`] : []),
		...(filters.unit ? [sql`${columns.unit} = ${filters.unit}`] : []),
		...(searchText
			? [
					sql`position(lower(${searchText}) in lower(${columns.apClass} || ' ' || ${columns.unit})) > 0`
				]
			: []),
		...(from ? [sql`${columns.attemptedAt} >= ${new Date(from)}`] : []),
		...(to ? [sql`${columns.attemptedAt} <= ${new Date(to)}`] : [])
	];
	const sources: SQL[] = [];
	if (filters.kind !== 'frq') {
		const conditions = [
			...commonConditions(mcqAttempts),
			...(filters.result === 'correct' ? [sql`${mcqAttempts.wasCorrect} = true`] : []),
			...(filters.result === 'incorrect' ? [sql`${mcqAttempts.wasCorrect} = false`] : [])
		];
		sources.push(sql`
			SELECT
				'mcq'::text AS kind,
				${mcqAttempts.id} AS id,
				${mcqAttempts.questionId} AS "questionId",
				${mcqAttempts.apClass} AS "apClass",
				${mcqAttempts.unit} AS unit,
				${mcqAttempts.selectedAnswer} AS "selectedAnswer",
				${mcqAttempts.wasCorrect} AS "wasCorrect",
				${mcqAttempts.timeTakenMs} AS "timeTakenMs",
				${mcqAttempts.attemptedAt} AS "attemptedAt",
				${mcqAttempts.finalAnswer} AS "finalAnswer",
				${mcqAttempts.answerCount} AS "answerCount",
				${mcqAttempts.hintsShown} AS "hintsShown",
				${mcqAttempts.terminalOutcome} AS "terminalOutcome",
				${mcqAttempts.experimentKey} AS "experimentKey",
				${mcqAttempts.experimentVersion} AS "experimentVersion",
				${mcqAttempts.displayedVariant} AS "displayedVariant",
				NULL::integer AS "pointsEarned",
				NULL::integer AS "pointsAvailable",
				NULL::integer AS percentage,
				CASE WHEN ${mcqAttempts.wasCorrect} THEN 100
					WHEN ${mcqAttempts.wasCorrect} = false THEN 0 ELSE -1 END AS "resultScore"
			FROM ${mcqAttempts}
			WHERE ${sql.join(conditions, sql` AND `)}
		`);
	}
	if (includeFrq && filters.kind !== 'mcq') {
		const conditions = [
			sql`${frqAttempts.status} = 'graded'`,
			...commonConditions({
				userId: frqAttempts.userId,
				apClass: frqAttempts.apClass,
				unit: frqAttempts.unit,
				attemptedAt: frqAttempts.createdAt
			}),
			...(filters.result === 'correct'
				? [sql`${frqAttemptGrades.percentage} >= ${FRQ_PASS_THRESHOLD}`]
				: []),
			...(filters.result === 'incorrect'
				? [sql`${frqAttemptGrades.percentage} < ${FRQ_PASS_THRESHOLD}`]
				: [])
		];
		sources.push(sql`
			SELECT
				'frq'::text AS kind,
				${frqAttempts.id} AS id,
				${frqAttempts.questionId} AS "questionId",
				${frqAttempts.apClass} AS "apClass",
				${frqAttempts.unit} AS unit,
				NULL::text AS "selectedAnswer",
				NULL::boolean AS "wasCorrect",
				${frqAttempts.timeTakenMs} AS "timeTakenMs",
				${frqAttempts.createdAt} AS "attemptedAt",
				NULL::text AS "finalAnswer",
				NULL::integer AS "answerCount",
				NULL::integer AS "hintsShown",
				NULL::text AS "terminalOutcome",
				NULL::text AS "experimentKey",
				NULL::integer AS "experimentVersion",
				NULL::text AS "displayedVariant",
				${frqAttemptGrades.pointsEarned} AS "pointsEarned",
				${frqAttemptGrades.pointsAvailable} AS "pointsAvailable",
				${frqAttemptGrades.percentage} AS percentage,
				${frqAttemptGrades.percentage} AS "resultScore"
			FROM ${frqAttempts}
			INNER JOIN ${frqAttemptGrades}
				ON ${frqAttemptGrades.attemptId} = ${frqAttempts.id}
			WHERE ${sql.join(conditions, sql` AND `)}
		`);
	}

	const history = sql.join(sources, sql` UNION ALL `);
	const direction = sql.raw(sort.direction === 'asc' ? 'ASC' : 'DESC');
	const primarySort =
		sort.field === 'subject'
			? sql`"apClass" ${direction}, unit ${direction}, "attemptedAt" ${direction}`
			: sort.field === 'result'
				? sql`"resultScore" ${direction}, "attemptedAt" ${direction}`
				: sql`"attemptedAt" ${direction}`;
	const offset = (page - 1) * limit;
	const [pageResult, summaryResult] = await Promise.all([
		db.execute<HistorySqlRow>(sql`
			WITH history AS (${history})
			SELECT * FROM history
			ORDER BY ${primarySort}, kind ASC
			LIMIT ${limit} OFFSET ${offset}
		`),
		db.execute<HistorySummaryRow>(sql`
			WITH history AS (${history})
			SELECT
				count(*)::int AS total,
				count(*) FILTER (WHERE kind = 'frq' OR "selectedAnswer" IS NOT NULL)::int AS answered,
				count(*) FILTER (WHERE "resultScore" >= ${FRQ_PASS_THRESHOLD})::int AS correct,
				count(*) FILTER (WHERE "resultScore" >= 0)::int AS graded,
				round(avg("timeTakenMs") FILTER (WHERE "timeTakenMs" > 0))::int AS "avgTimeMs"
			FROM history
		`)
	]);
	const items: PracticeHistoryItem[] = pageResult.rows.map((row) =>
		row.kind === 'mcq'
			? {
					kind: 'mcq',
					attempt: {
						questionId: row.questionId,
						apClass: row.apClass,
						unit: row.unit,
						selectedAnswer: (row.selectedAnswer as IQuestionAttempt['selectedAnswer']) ?? undefined,
						wasCorrect: row.wasCorrect ?? undefined,
						timeTakenMs: row.timeTakenMs ?? undefined,
						attemptedAt: new Date(row.attemptedAt),
						finalAnswer: (row.finalAnswer as IQuestionAttempt['finalAnswer']) ?? undefined,
						answerCount: row.answerCount ?? undefined,
						hintsShown: row.hintsShown ?? undefined,
						terminalOutcome:
							(row.terminalOutcome as IQuestionAttempt['terminalOutcome']) ?? undefined,
						experimentKey: row.experimentKey ?? undefined,
						experimentVersion: row.experimentVersion ?? undefined,
						displayedVariant:
							(row.displayedVariant as IQuestionAttempt['displayedVariant']) ?? undefined
					},
					question: null
				}
			: {
					kind: 'frq',
					attempt: {
						id: row.id,
						questionId: row.questionId,
						apClass: row.apClass,
						unit: row.unit,
						pointsEarned: Number(row.pointsEarned),
						pointsAvailable: Number(row.pointsAvailable),
						percentage: Number(row.percentage),
						timeTakenMs: row.timeTakenMs ?? 0,
						attemptedAt: new Date(row.attemptedAt).toISOString()
					},
					question: null
				}
	);
	const summaryRow = summaryResult.rows[0] ?? {
		total: 0,
		answered: 0,
		correct: 0,
		graded: 0,
		avgTimeMs: null
	};
	const total = Number(summaryRow.total);
	const correct = Number(summaryRow.correct);
	const graded = Number(summaryRow.graded);
	return {
		items,
		total,
		page,
		limit,
		summary: {
			total,
			answered: Number(summaryRow.answered),
			correct,
			accuracy: graded ? Math.round((correct / graded) * 100) : null,
			avgTimeMs: summaryRow.avgTimeMs === null ? null : Number(summaryRow.avgTimeMs)
		}
	};
}

export async function hydratePracticeHistoryItems(
	items: PracticeHistoryItem[]
): Promise<PracticeHistoryItem[]> {
	const mcqItems = items.filter((item): item is McqHistoryItem => item.kind === 'mcq');
	const hydratedMcq = await hydrateMcqHistoryItems(mcqItems);
	let i = 0;
	return items.map((item) => (item.kind === 'mcq' ? hydratedMcq[i++]! : item));
}
