import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { questionRecentTopics } from '#lib/server/neon/schema.js';

const DEFAULT_WINDOW = 20;
type QuestionKind = 'mcq' | 'frq';
export type RecentTopicBucket = {
	kind: QuestionKind;
	course: string;
	unit: string;
};
export type RecentTopicSummary = {
	course: string;
	unit: string;
	topicsCovered: string;
	createdAt: Date;
};

export function recentTopicBucketKey(opts: RecentTopicBucket): string {
	return `${opts.kind}\u0000${opts.course}\u0000${opts.unit}`;
}

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

/** Grouped recent-topic reads for a refill wave, newest first per bucket. */
export async function getRecentTopicsByBucket(
	buckets: RecentTopicBucket[],
	limit = DEFAULT_WINDOW
): Promise<Map<string, string[]>> {
	const unique = new Map<string, RecentTopicBucket>();
	for (const bucket of buckets) unique.set(recentTopicBucketKey(bucket), bucket);
	const uniqueBuckets = [...unique.values()];
	const topics = new Map(
		uniqueBuckets.map((bucket) => [recentTopicBucketKey(bucket), [] as string[]])
	);
	if (!uniqueBuckets.length) return topics;

	const bucketFilter = or(
		...uniqueBuckets.map((bucket) =>
			and(
				eq(questionRecentTopics.kind, bucket.kind),
				eq(questionRecentTopics.course, bucket.course),
				eq(questionRecentTopics.unit, bucket.unit)
			)
		)
	);
	if (!bucketFilter) return topics;

	const result = await getNeonDatabase().execute<{
		kind: QuestionKind;
		course: string;
		unit: string;
		topicsCovered: string;
	}>(sql`
		SELECT kind, course, unit, topics_covered AS "topicsCovered"
		FROM (
			SELECT
				${questionRecentTopics.kind} AS kind,
				${questionRecentTopics.course} AS course,
				${questionRecentTopics.unit} AS unit,
				${questionRecentTopics.topicsCovered} AS topics_covered,
				row_number() OVER (
					PARTITION BY ${questionRecentTopics.kind}, ${questionRecentTopics.course}, ${questionRecentTopics.unit}
					ORDER BY ${questionRecentTopics.createdAt} DESC
				) AS rn
			FROM ${questionRecentTopics}
			WHERE ${and(bucketFilter, ne(questionRecentTopics.topicsCovered, ''))}
		) ranked
		WHERE rn <= ${limit}
		ORDER BY rn ASC
	`);

	for (const row of result.rows) {
		topics.get(recentTopicBucketKey(row))?.push(row.topicsCovered);
	}
	return topics;
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
