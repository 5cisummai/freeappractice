import type { IQuestionAttempt } from '$lib/users/records.server';
import type { FrqHistoryItem, HistorySummary } from '$lib/users/types';
import { getQuestionsLookupMap } from '$lib/questions/storage.server';
import type { StoredQuestion } from '$lib/questions/storage.server';
import { FrqAttempt } from '$lib/frq/model.server';
import { connectDb } from '$lib/server/db';

type McqHistoryItem = {
	kind: 'mcq';
	attempt: IQuestionAttempt;
	question: StoredQuestion | null;
};

type PracticeHistoryItem = McqHistoryItem | FrqHistoryItem;

type McqHistoryPageResult = {
	items: McqHistoryItem[];
	total: number;
	page: number;
	limit: number;
	summary: HistorySummary;
};

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

function attemptOutcome(
	attempt: IQuestionAttempt | FrqHistoryItem['attempt']
): 'correct' | 'incorrect' | 'other' {
	if ('percentage' in attempt) {
		return attempt.percentage >= FRQ_PASS_THRESHOLD ? 'correct' : 'incorrect';
	}
	if (attempt.wasCorrect === undefined) return 'other';
	return attempt.wasCorrect ? 'correct' : 'incorrect';
}

function matchesHistoryFilters(
	attempt: IQuestionAttempt | FrqHistoryItem['attempt'],
	filters: HistoryFilters
): boolean {
	if (filters.unit && (attempt.unit ?? '') !== filters.unit) return false;
	if (filters.result && attemptOutcome(attempt) !== filters.result) return false;
	const from = parseHistoryDate(filters.from);
	if (from !== undefined && new Date(attempt.attemptedAt).getTime() < from) return false;
	const to = parseHistoryDate(filters.to, true);
	if (to !== undefined && new Date(attempt.attemptedAt).getTime() > to) return false;
	return true;
}

function summarizeHistory(items: PracticeHistoryItem[]): HistorySummary {
	let answered = 0;
	let correct = 0;
	let graded = 0;
	let timeTotal = 0;
	let timeCount = 0;
	for (const item of items) {
		const outcome = attemptOutcome(item.attempt);
		if (item.kind === 'mcq' && item.attempt.selectedAnswer) answered += 1;
		if (item.kind === 'frq') answered += 1;
		if (outcome !== 'other') {
			graded += 1;
			if (outcome === 'correct') correct += 1;
		}
		if (item.attempt.timeTakenMs && item.attempt.timeTakenMs > 0) {
			timeTotal += item.attempt.timeTakenMs;
			timeCount += 1;
		}
	}
	return {
		total: items.length,
		answered,
		correct,
		accuracy: graded > 0 ? Math.round((correct / graded) * 100) : null,
		avgTimeMs: timeCount > 0 ? Math.round(timeTotal / timeCount) : null
	};
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

function matchesHistorySearch(
	attempt: { apClass: string; unit?: string },
	search?: string
): boolean {
	const query = search?.trim().toLowerCase();
	if (!query) return true;
	const haystack = [attempt.apClass, attempt.unit ?? ''].join(' ').toLowerCase();
	return haystack.includes(query);
}

function compareAttempts(
	a: IQuestionAttempt | FrqHistoryItem['attempt'],
	b: IQuestionAttempt | FrqHistoryItem['attempt'],
	sort: HistorySort
): number {
	let comparison: number;
	switch (sort.field) {
		case 'attemptedAt':
			comparison = new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime();
			break;
		case 'subject':
			comparison = a.apClass.localeCompare(b.apClass) || (a.unit ?? '').localeCompare(b.unit ?? '');
			break;
		case 'result':
			comparison =
				('percentage' in a
					? a.percentage
					: a.wasCorrect === undefined
						? -1
						: a.wasCorrect
							? 100
							: 0) -
				('percentage' in b
					? b.percentage
					: b.wasCorrect === undefined
						? -1
						: b.wasCorrect
							? 100
							: 0);
			break;
		default: {
			const _exhaustive: never = sort.field;
			return _exhaustive;
		}
	}
	if (comparison === 0) {
		comparison = new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime();
	}
	return sort.direction === 'asc' ? comparison : -comparison;
}

export function getMcqHistoryPage(
	user: { questionHistory: IQuestionAttempt[] },
	options: {
		page: number;
		limit: number;
		apClass?: string;
		search?: string;
		sort?: HistorySort;
		filters?: HistoryFilters;
	}
): McqHistoryPageResult {
	const {
		page,
		limit,
		apClass,
		search,
		sort = { field: 'attemptedAt', direction: 'desc' },
		filters = {}
	} = options;

	if (filters.kind === 'frq') {
		return { items: [], total: 0, page, limit, summary: summarizeHistory([]) };
	}

	let attempts = user.questionHistory.slice();
	if (apClass) attempts = attempts.filter((entry) => entry.apClass === apClass);
	if (search?.trim()) attempts = attempts.filter((entry) => matchesHistorySearch(entry, search));
	attempts = attempts.filter((entry) => matchesHistoryFilters(entry, filters));
	attempts.sort((a, b) => compareAttempts(a, b, sort));

	const allItems: McqHistoryItem[] = attempts.map((attempt) => ({
		kind: 'mcq' as const,
		attempt,
		question: null
	}));
	const total = allItems.length;
	const skip = (page - 1) * limit;

	return {
		items: allItems.slice(skip, skip + limit),
		total,
		page,
		limit,
		summary: summarizeHistory(allItems)
	};
}

export async function hydrateMcqHistoryItems(items: McqHistoryItem[]): Promise<McqHistoryItem[]> {
	const uniqueIds = [...new Set(items.map((item) => item.attempt.questionId))];
	if (uniqueIds.length === 0) return items;

	const lookup = await getQuestionsLookupMap(uniqueIds);

	return items.map((item) => ({
		kind: 'mcq' as const,
		attempt: item.attempt,
		question: lookup.get(item.attempt.questionId) ?? null
	}));
}

function comparePracticeItems(
	a: PracticeHistoryItem,
	b: PracticeHistoryItem,
	sort: HistorySort
): number {
	const comparison = compareAttempts(a.attempt, b.attempt, sort);
	if (comparison !== 0) return comparison;
	return a.kind.localeCompare(b.kind);
}

export async function getPracticeHistoryPage(
	user: { questionHistory: IQuestionAttempt[] },
	userId: string,
	options: {
		page: number;
		limit: number;
		apClass?: string;
		search?: string;
		sort?: HistorySort;
		filters?: HistoryFilters;
	}
): Promise<PracticeHistoryPageResult> {
	const {
		page,
		limit,
		apClass,
		search,
		sort = { field: 'attemptedAt', direction: 'desc' },
		filters = {}
	} = options;
	await connectDb();

	const mcqItems: McqHistoryItem[] =
		filters.kind === 'frq'
			? []
			: user.questionHistory
					.filter(
						(attempt) =>
							(!apClass || attempt.apClass === apClass) &&
							matchesHistorySearch(attempt, search) &&
							matchesHistoryFilters(attempt, filters)
					)
					.map((attempt) => ({ kind: 'mcq', attempt, question: null }));
	const frqQuery: { userId: string; status: 'graded'; apClass?: string } = {
		userId,
		status: 'graded',
		...(apClass ? { apClass } : {})
	};
	const frqAttempts = await FrqAttempt.find(frqQuery, {
		_id: 1,
		questionId: 1,
		apClass: 1,
		unit: 1,
		timeTakenMs: 1,
		createdAt: 1,
		grade: 1
	})
		.lean()
		.exec();
	const frqItems: FrqHistoryItem[] = frqAttempts
		.filter(
			(attempt) =>
				attempt.grade &&
				filters.kind !== 'mcq' &&
				matchesHistorySearch(attempt, search) &&
				matchesHistoryFilters(
					{
						id: String(attempt._id),
						questionId: attempt.questionId,
						apClass: attempt.apClass,
						unit: attempt.unit,
						pointsEarned: attempt.grade.pointsEarned,
						pointsAvailable: attempt.grade.pointsAvailable,
						percentage: attempt.grade.percentage,
						timeTakenMs: attempt.timeTakenMs,
						attemptedAt: attempt.createdAt.toISOString()
					},
					filters
				)
		)
		.map((attempt) => ({
			kind: 'frq',
			attempt: {
				id: String(attempt._id),
				questionId: attempt.questionId,
				apClass: attempt.apClass,
				unit: attempt.unit,
				pointsEarned: attempt.grade!.pointsEarned,
				pointsAvailable: attempt.grade!.pointsAvailable,
				percentage: attempt.grade!.percentage,
				timeTakenMs: attempt.timeTakenMs,
				attemptedAt: attempt.createdAt.toISOString()
			},
			question: null
		}));

	const allItems = [...mcqItems, ...frqItems].sort((a, b) => comparePracticeItems(a, b, sort));
	const total = allItems.length;
	const skip = (page - 1) * limit;
	return {
		items: allItems.slice(skip, skip + limit),
		total,
		page,
		limit,
		summary: summarizeHistory(allItems)
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
