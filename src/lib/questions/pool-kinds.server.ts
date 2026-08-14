import { and, eq, sql } from 'drizzle-orm';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqQuestions, mcqQuestions } from '$lib/server/neon/schema';
import { poolTargetForBucket, type QuestionPoolConfig } from '$lib/questions/pool-constants';
import type { PoolRefillQuestionType } from '$lib/questions/pool-refill-types.server';

export type PoolKindBucket = {
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
};

export type PoolKindAdapter = {
	questionType: PoolRefillQuestionType;
	minimumGenerationHeadroomMs: number;
	listBuckets: () => PoolKindBucket[];
	countActive: (apClass: string, unit: string) => Promise<number>;
	countActiveByBucket: () => Promise<Map<string, number>>;
	targetFor: (input: {
		apClass: string;
		generationCountsByClass?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => number;
};

function bucketKey(apClass: string, unit: string): string {
	return `${apClass}\u0000${unit}`;
}

function listMcqBuckets(): PoolKindBucket[] {
	return getCourses().flatMap((course) =>
		getUnitsForClass(course.name).map((unit) => ({
			questionType: 'mcq' as const,
			apClass: course.name,
			unit
		}))
	);
}

function listFrqBuckets(): PoolKindBucket[] {
	return getFrqCourseNames().flatMap((apClass) =>
		getUnitsForClass(apClass).map((unit) => ({ questionType: 'frq' as const, apClass, unit }))
	);
}

async function countActiveMcq(apClass: string, unit: string): Promise<number> {
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

async function countActiveFrq(apClass: string, unit: string): Promise<number> {
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

async function countActiveMcqByBucket(): Promise<Map<string, number>> {
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

async function countActiveFrqByBucket(): Promise<Map<string, number>> {
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

const adapters = {
	mcq: {
		questionType: 'mcq',
		minimumGenerationHeadroomMs: 10_000,
		listBuckets: listMcqBuckets,
		countActive: countActiveMcq,
		countActiveByBucket: countActiveMcqByBucket,
		targetFor: (input) => poolTargetForBucket({ questionType: 'mcq', ...input })
	},
	frq: {
		questionType: 'frq',
		minimumGenerationHeadroomMs: 35_000,
		listBuckets: listFrqBuckets,
		countActive: countActiveFrq,
		countActiveByBucket: countActiveFrqByBucket,
		targetFor: (input) => poolTargetForBucket({ questionType: 'frq', ...input })
	}
} satisfies Record<PoolRefillQuestionType, PoolKindAdapter>;

export function getPoolKindAdapter(questionType: PoolRefillQuestionType): PoolKindAdapter {
	return adapters[questionType];
}

export const POOL_QUESTION_TYPES = Object.freeze(Object.keys(adapters) as PoolRefillQuestionType[]);
