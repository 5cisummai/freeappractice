import { and, eq, sql } from 'drizzle-orm';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqQuestions } from '$lib/server/neon/schema';
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

async function countActive(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(mcqQuestions)
		.where(
			and(
				eq(mcqQuestions.apClass, apClass),
				eq(mcqQuestions.unit, unit),
				eq(mcqQuestions.active, true)
			)
		);
	return Number(row?.count ?? 0);
}

async function countActiveByBucket(): Promise<Map<string, number>> {
	const rows = await getNeonDatabase()
		.select({
			apClass: mcqQuestions.apClass,
			unit: mcqQuestions.unit,
			count: sql<number>`count(*)`
		})
		.from(mcqQuestions)
		.where(eq(mcqQuestions.active, true))
		.groupBy(mcqQuestions.apClass, mcqQuestions.unit);
	return new Map(rows.map((row) => [bucketKey(row.apClass, row.unit), Number(row.count)]));
}

/** MCQ catalog, storage counters, and target metadata. */
export const mcqPoolKind: PoolKindAdapter = {
	questionType: 'mcq',
	minimumGenerationHeadroomMs: 10_000,
	listBuckets,
	countActive,
	countActiveByBucket,
	targetFor: (input: {
		apClass: string;
		generationCountsByClass?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'mcq', ...input })
};
