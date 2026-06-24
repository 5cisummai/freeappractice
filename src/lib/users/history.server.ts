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

export function getMcqHistoryPage(
	user: { questionHistory: IQuestionAttempt[] },
	options: { page: number; limit: number; apClass?: string }
): McqHistoryPageResult {
	const { page, limit, apClass } = options;

	let attempts = user.questionHistory
		.slice()
		.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());

	if (apClass) {
		attempts = attempts.filter((entry) => entry.apClass === apClass);
	}

	const total = attempts.length;
	const skip = (page - 1) * limit;
	const pageAttempts = attempts.slice(skip, skip + limit);

	return {
		items: pageAttempts.map((attempt) => ({ attempt, question: null })),
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
