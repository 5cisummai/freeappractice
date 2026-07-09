import type { IQuestionAttempt } from '$lib/users/records.server';
import { getQuestionsLookupMap } from '$lib/questions/lookup.server';
import type { StoredQuestion } from '$lib/questions/storage.server';

export type McqHistoryItem = {
	attempt: IQuestionAttempt;
	question: StoredQuestion | null;
};

export type McqHistoryPageResult = {
	items: McqHistoryItem[];
	total: number;
	page: number;
	limit: number;
};

export type HistorySort = {
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

function compareAttempts(a: IQuestionAttempt, b: IQuestionAttempt, sort: HistorySort): number {
	let comparison = 0;
	switch (sort.field) {
		case 'attemptedAt':
			comparison = new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime();
			break;
		case 'subject':
			comparison =
				a.apClass.localeCompare(b.apClass) || (a.unit ?? '').localeCompare(b.unit ?? '');
			break;
		case 'result':
			comparison = Number(a.wasCorrect) - Number(b.wasCorrect);
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
		items: attempts.slice(skip, skip + limit).map((attempt) => ({ attempt, question: null })),
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
		attempt: item.attempt,
		question: lookup.get(item.attempt.questionId) ?? null
	}));
}
