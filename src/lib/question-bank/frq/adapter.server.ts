import { and, eq, sql } from 'drizzle-orm';
import { getUnitsForClass } from '$lib/catalog/ap-classes';
import { getFrqCourseNames } from '$lib/question-bank/frq/profiles.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqQuestions } from '$lib/server/neon/schema';
import { poolTargetForBucket, type QuestionPoolConfig } from '$lib/question-bank/pool-constants';
import type { PoolKindAdapter, PoolKindBucket } from '$lib/question-bank/pool-kinds.server';

function bucketKey(apClass: string, unit: string): string {
	return `${apClass}\u0000${unit}`;
}

function listBuckets(): PoolKindBucket[] {
	return getFrqCourseNames().flatMap((apClass) =>
		getUnitsForClass(apClass).map((unit) => ({ questionType: 'frq' as const, apClass, unit }))
	);
}

async function countActive(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(frqQuestions)
		.where(
			and(
				eq(frqQuestions.apClass, apClass),
				eq(frqQuestions.unit, unit),
				eq(frqQuestions.active, true)
			)
		);
	return Number(row?.count ?? 0);
}

async function countActiveByBucket(): Promise<Map<string, number>> {
	const rows = await getNeonDatabase()
		.select({
			apClass: frqQuestions.apClass,
			unit: frqQuestions.unit,
			count: sql<number>`count(*)`
		})
		.from(frqQuestions)
		.where(eq(frqQuestions.active, true))
		.groupBy(frqQuestions.apClass, frqQuestions.unit);
	return new Map(rows.map((row) => [bucketKey(row.apClass, row.unit), Number(row.count)]));
}

/** FRQ catalog, storage counters, and target metadata. */
export const frqPoolKind: PoolKindAdapter = {
	questionType: 'frq',
	minimumGenerationHeadroomMs: 35_000,
	listBuckets,
	countActive,
	countActiveByBucket,
	targetFor: (input: {
		apClass: string;
		generationCountsByClass?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'frq', ...input })
};
