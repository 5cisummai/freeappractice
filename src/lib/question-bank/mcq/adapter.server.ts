import { eq, sql } from 'drizzle-orm';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';
import { countActiveMcqQuestions } from '$lib/question-bank/mcq/repository.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqQuestions } from '$lib/server/neon/schema';
import { questionBucketFields } from '$lib/server/neon/jsonb';
import { poolTargetForBucket, type QuestionPoolConfig } from '$lib/question-bank/pool-constants';
import type { PoolKindAdapter, PoolKindBucket } from '$lib/question-bank/pool-kinds.server';

function bucketKey(apClass: string, unit: string): string {
	return `${apClass}\u0000${unit}`;
}

function listBuckets(): PoolKindBucket[] {
	return getCourses().flatMap((course) =>
		getUnitsForClass(course.name).map((unit) => ({
			questionType: 'mcq' as const,
			apClass: course.name,
			unit
		}))
	);
}

async function countActiveByBucket(): Promise<Map<string, number>> {
	const { apClass, unit } = questionBucketFields(mcqQuestions.data);
	const rows = await getNeonDatabase()
		.select({
			apClass,
			unit,
			count: sql<number>`count(*)`
		})
		.from(mcqQuestions)
		.where(eq(mcqQuestions.active, true))
		.groupBy(apClass, unit);
	return new Map(rows.map((row) => [bucketKey(row.apClass, row.unit), Number(row.count)]));
}

/** MCQ catalog, storage counters, and target metadata. */
export const mcqPoolKind: PoolKindAdapter = {
	questionType: 'mcq',
	minimumGenerationHeadroomMs: 10_000,
	listBuckets,
	countActive: countActiveMcqQuestions,
	countActiveByBucket,
	targetFor: (input: {
		apClass: string;
		generationCountsByClass?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'mcq', ...input })
};
