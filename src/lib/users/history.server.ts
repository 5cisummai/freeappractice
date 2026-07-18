import type { IQuestionAttempt } from '$lib/users/records.server';
import type { FrqHistoryItem } from '$lib/users/types';
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
};

type PracticeHistoryPageResult = {
	items: PracticeHistoryItem[];
	total: number;
	page: number;
	limit: number;
};

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
	options: { page: number; limit: number; apClass?: string; sort?: HistorySort }
): McqHistoryPageResult {
	const { page, limit, apClass, sort = { field: 'attemptedAt', direction: 'desc' } } = options;

	let attempts = user.questionHistory.slice();
	if (apClass) attempts = attempts.filter((entry) => entry.apClass === apClass);
	attempts.sort((a, b) => compareAttempts(a, b, sort));

	const total = attempts.length;
	const skip = (page - 1) * limit;

	return {
		items: attempts.slice(skip, skip + limit).map((attempt) => ({
			kind: 'mcq' as const,
			attempt,
			question: null
		})),
		total,
		page,
		limit
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
	options: { page: number; limit: number; apClass?: string; sort?: HistorySort }
): Promise<PracticeHistoryPageResult> {
	const { page, limit, apClass, sort = { field: 'attemptedAt', direction: 'desc' } } = options;
	await connectDb();

	const mcqItems: McqHistoryItem[] = user.questionHistory
		.filter((attempt) => !apClass || attempt.apClass === apClass)
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
		.filter((attempt) => attempt.grade)
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
		limit
	};
}

export async function hydratePracticeHistoryItems(
	items: PracticeHistoryItem[]
): Promise<PracticeHistoryItem[]> {
	const mcqItems = items.filter((item): item is McqHistoryItem => item.kind === 'mcq');
	const hydratedMcq = await hydrateMcqHistoryItems(mcqItems);
	const byQuestionId = new Map(hydratedMcq.map((item) => [item.attempt.questionId, item]));
	return items.map((item) =>
		item.kind === 'mcq' ? byQuestionId.get(item.attempt.questionId)! : item
	);
}
