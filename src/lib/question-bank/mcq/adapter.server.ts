import { and, eq, sql } from 'drizzle-orm';
import { getCourses, getUnitsForCourse, isMcqPracticeCourse } from '#lib/catalog/courses.js';
import { countActiveMcqQuestions } from '#lib/question-bank/mcq/repository.server.js';
import { mcqServableQualityPredicate } from '#lib/question-bank/quality/serving-filter.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { mcqQuestions } from '#lib/server/neon/schema.js';
import { questionBucketFields } from '#lib/server/neon/jsonb.js';
import { poolTargetForBucket, type QuestionPoolConfig } from '#lib/question-bank/pool-constants.js';
import type { PoolKindAdapter, PoolKindBucket } from '#lib/question-bank/pool-kinds.server.js';

function bucketKey(course: string, unit: string): string {
	return `${course}\u0000${unit}`;
}

function listBuckets(): PoolKindBucket[] {
	return getCourses().flatMap((course) => {
		if (!isMcqPracticeCourse(course.name)) return [];
		return getUnitsForCourse(course.name).map((unit) => ({
			questionType: 'mcq' as const,
			course: course.name,
			unit
		}));
	});
}

async function countActiveByBucket(): Promise<Map<string, number>> {
	const { course, unit } = questionBucketFields(mcqQuestions.data);
	const rows = await getNeonDatabase()
		.select({
			course,
			unit,
			count: sql<number>`count(*)`
		})
		.from(mcqQuestions)
		.where(and(eq(mcqQuestions.active, true), mcqServableQualityPredicate()))
		.groupBy(course, unit);
	return new Map(rows.map((row) => [bucketKey(row.course, row.unit), Number(row.count)]));
}

/** MCQ catalog, storage counters, and target metadata. */
export const mcqPoolKind: PoolKindAdapter = {
	questionType: 'mcq',
	minimumGenerationHeadroomMs: 10_000,
	listBuckets,
	countActive: countActiveMcqQuestions,
	countActiveByBucket,
	targetFor: (input: {
		course: string;
		generationCountsByCourse?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'mcq', ...input })
};
