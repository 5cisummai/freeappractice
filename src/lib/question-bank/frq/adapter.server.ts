import { eq, sql } from 'drizzle-orm';
import { frqBucketUnits, frqPracticeFor } from '$lib/question-bank/frq/practice';
import { countActiveFrqQuestions } from '$lib/question-bank/frq/model.server';
import { getFrqCourseNames } from '$lib/question-bank/frq/profiles.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqQuestions } from '$lib/server/neon/schema';
import { questionBucketFields } from '$lib/server/neon/jsonb';
import { poolTargetForBucket, type QuestionPoolConfig } from '$lib/question-bank/pool-constants';
import type { PoolKindAdapter, PoolKindBucket } from '$lib/question-bank/pool-kinds.server';

function bucketKey(course: string, unit: string): string {
	return `${course}\u0000${unit}`;
}

function listBuckets(): PoolKindBucket[] {
	return getFrqCourseNames().flatMap((course) =>
		frqBucketUnits(course).map((unit) => ({ questionType: 'frq' as const, course, unit }))
	);
}

async function countActiveByBucket(): Promise<Map<string, number>> {
	const { course, unit } = questionBucketFields(frqQuestions.data);
	const formatId = sql<string>`${frqQuestions.data} ->> 'formatId'`;
	const rows = await getNeonDatabase()
		.select({
			course,
			unit,
			formatId,
			count: sql<number>`count(*)`
		})
		.from(frqQuestions)
		.where(eq(frqQuestions.active, true))
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
