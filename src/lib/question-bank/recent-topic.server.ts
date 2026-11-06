import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { questionRecentTopics } from '#lib/server/neon/schema.js';

const DEFAULT_WINDOW = 20;
type QuestionKind = 'mcq' | 'frq';
export type RecentTopicSummary = {
	course: string;
	unit: string;
	topicsCovered: string;
	createdAt: Date;
};

export type RecentTopicBucket = {
	kind: QuestionKind;
	course: string;
	unit: string;
};

export function recentTopicBucketKey(kind: QuestionKind, course: string, unit: string): string {
	return `${kind}\u0000${course}\u0000${unit}`;
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

/** Newest topics for many buckets in one query. Empty arrays mean no rows, not “fetch later”. */
export async function getRecentTopicsByBucket(
	buckets: RecentTopicBucket[],
	limit = DEFAULT_WINDOW
): Promise<Map<string, string[]>> {
	const topics = new Map<string, string[]>();
	const unique = new Map<string, RecentTopicBucket>();
	for (const bucket of buckets) {
		const key = recentTopicBucketKey(bucket.kind, bucket.course, bucket.unit);
		if (!unique.has(key)) unique.set(key, bucket);
		if (!topics.has(key)) topics.set(key, []);
	}
	if (!unique.size) return topics;

	const result = await getNeonDatabase().execute<{
		kind: QuestionKind;
		course: string;
		unit: string;
		topicsCovered: string;
	}>(sql`
		SELECT kind, course, unit, topics_covered AS "topicsCovered"
		FROM (
			SELECT
				topic.kind,
				topic.course,
				topic.unit,
				topic.topics_covered,
				ROW_NUMBER() OVER (
					PARTITION BY topic.kind, topic.course, topic.unit
					ORDER BY topic.created_at DESC
				) AS rn
			FROM ${questionRecentTopics} AS topic
			INNER JOIN jsonb_to_recordset(${JSON.stringify([...unique.values()])}::jsonb) AS wanted(
				"kind" text,
				"course" text,
				"unit" text
			) ON topic.kind = wanted.kind
				AND topic.course = wanted.course
				AND topic.unit = wanted.unit
			WHERE topic.topics_covered <> ''
		) ranked
		WHERE rn <= ${limit}
		ORDER BY kind, course, unit, rn
	`);

	for (const row of result.rows) {
		topics.get(recentTopicBucketKey(row.kind, row.course, row.unit))?.push(row.topicsCovered);
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
