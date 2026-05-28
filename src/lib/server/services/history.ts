import type { IQuestionAttempt, IUser } from '$lib/server/models/user';
import { getQuestionsFromS3, type StoredQuestion } from '$lib/server/services/question-storage';

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
	user: Pick<IUser, 'questionHistory'>,
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

	const questions = await getQuestionsFromS3(uniqueIds);
	const byId = new Map(questions.map((q) => [q.id, q]));

	return items.map((item) => ({
		attempt: item.attempt,
		question: byId.get(item.attempt.questionId) ?? null
	}));
}
