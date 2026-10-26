import { and, eq, or, sql } from 'drizzle-orm';
import {
	frqBucketUnits,
	frqPracticeFor,
	frqStoredPoolFilter
} from '#lib/question-bank/frq/practice.js';
import { countActiveFrqQuestions } from '#lib/question-bank/frq/model.server.js';
import { getFrqCourseNames } from '#lib/question-bank/frq/profiles.server.js';
import { frqServableQualityPredicate } from '#lib/question-bank/quality/serving-filter.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { frqQuestions } from '#lib/server/neon/schema.js';
import { questionBucketFields } from '#lib/server/neon/jsonb.js';
import { poolTargetForBucket, type QuestionPoolConfig } from '#lib/question-bank/pool-constants.js';
import type { PoolKindAdapter, PoolKindBucket } from '#lib/question-bank/pool-kinds.server.js';

function bucketKey(course: string, unit: string): string {
	return `${course}\u0000${unit}`;
}

function listBuckets(): PoolKindBucket[] {
	return getFrqCourseNames().flatMap((course) =>
		frqBucketUnits(course).map((unit) => ({ questionType: 'frq' as const, course, unit }))
	);
}

async function countActiveByBucket(
	buckets?: Array<{ course: string; unit: string }>
): Promise<Map<string, number>> {
	const fields = questionBucketFields(frqQuestions.data);
	const { course, unit } = fields;
	const formatId = sql<string>`${frqQuestions.data} ->> 'formatId'`;
	const bucketFilter = buckets?.length
		? or(
				...buckets.map((bucket) => {
					const stored = frqStoredPoolFilter(bucket.course, bucket.unit);
					return and(
						eq(fields.course, bucket.course),
						eq(fields.unit, stored.unit),
						...(stored.formatId ? [eq(formatId, stored.formatId)] : [])
					);
				})
			)
		: undefined;
	const rows = await getNeonDatabase()
		.select({
			course,
			unit,
			formatId,
			count: sql<number>`count(*)`
		})
		.from(frqQuestions)
		.where(
			and(
				eq(frqQuestions.active, true),
				frqServableQualityPredicate(),
				...(bucketFilter ? [bucketFilter] : [])
			)
		)
		.groupBy(course, unit, formatId);
	const counts = new Map<string, number>();
	for (const row of rows) {
		const keyUnit = frqPracticeFor(row.course)?.control === 'task' ? row.formatId : row.unit;
		const key = bucketKey(row.course, keyUnit);
		counts.set(key, (counts.get(key) ?? 0) + Number(row.count));
	}
	return counts;
}

/** FRQ catalog, storage counters, and target metadata. */
export const frqPoolKind: PoolKindAdapter = {
	questionType: 'frq',
	minimumGenerationHeadroomMs: 35_000,
	listBuckets,
	countActive: countActiveFrqQuestions,
	countActiveByBucket,
	targetFor: (input: {
		course: string;
		generationCountsByCourse?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'frq', ...input })
};
