import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { questionRecentTopics } from '$lib/server/neon/schema';

const DEFAULT_WINDOW = 20;
type QuestionKind = 'mcq' | 'frq';
export type RecentTopicSummary = {
	course: string;
	unit: string;
	topicsCovered: string;
	createdAt: Date;
};

export async function recordRecentTopic(opts: {
	kind: QuestionKind;
	course: string;
	unit: string;
	topicsCovered: string;
	questionId?: string;
}): Promise<void> {
	const topicsCovered = opts.topicsCovered.trim();
	if (!topicsCovered) return;

	await getNeonDatabase()
		.insert(questionRecentTopics)
		.values({
			id: randomUUID(),
			kind: opts.kind,
			course: opts.course,
			unit: opts.unit,
			topicsCovered,
			questionId: opts.questionId ?? null
		});
}

export async function getRecentTopics(opts: {
	kind: QuestionKind;
	course: string;
	unit: string;
	limit?: number;
}): Promise<string[]> {
	const docs = await getNeonDatabase()
		.select({ topicsCovered: questionRecentTopics.topicsCovered })
		.from(questionRecentTopics)
		.where(
			and(
				eq(questionRecentTopics.kind, opts.kind),
				eq(questionRecentTopics.course, opts.course),
				eq(questionRecentTopics.unit, opts.unit),
				ne(questionRecentTopics.topicsCovered, '')
			)
		)
		.orderBy(desc(questionRecentTopics.createdAt))
		.limit(opts.limit ?? DEFAULT_WINDOW);
	return docs.map((doc) => doc.topicsCovered);
}

export async function getLatestRecentTopics(limit = 10): Promise<RecentTopicSummary[]> {
	return getNeonDatabase()
		.select({
			course: questionRecentTopics.course,
			unit: questionRecentTopics.unit,
			topicsCovered: questionRecentTopics.topicsCovered,
			createdAt: questionRecentTopics.createdAt
		})
		.from(questionRecentTopics)
		.orderBy(desc(questionRecentTopics.createdAt))
		.limit(limit);
}
