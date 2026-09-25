import { getNeonDatabase } from '$lib/server/neon/db';
import {
	questionGenerationByCourse,
	questionGenerationByGlobalUnit,
	questionGenerationByUnit
} from '$lib/server/neon/schema';
export interface GenerationStatsPayload {
	byCourse: Record<string, number>;
	byUnit: Record<string, number>;
	byCourseAndUnit: Record<string, Record<string, number>>;
	totals: { questions: number; totalQuestionChars: number };
}

export async function getGenerationStatsForApi(): Promise<GenerationStatsPayload> {
	const db = getNeonDatabase() as any;
	const [classes, units, details] = await Promise.all([
		db.select().from(questionGenerationByCourse as any),
		db.select().from(questionGenerationByGlobalUnit as any),
		db.select().from(questionGenerationByUnit as any)
	]);

	const byCourse: Record<string, number> = {};
	let questions = 0;
	let totalQuestionChars = 0;
	for (const row of classes as Array<{
		course: string;
		count: number;
		totalQuestionChars: number;
	}>) {
		byCourse[row.course] = Number(row.count);
		questions += Number(row.count);
		totalQuestionChars += Number(row.totalQuestionChars);
	}

	const byUnit: Record<string, number> = {};
	for (const row of units as Array<{ unit: string; count: number }>)
		byUnit[row.unit] = Number(row.count);

	const byCourseAndUnit: Record<string, Record<string, number>> = {};
	for (const row of details as Array<{ course: string; unit: string; count: number }>) {
		(byCourseAndUnit[row.course] ??= {})[row.unit] = Number(row.count);
	}

	return { byCourse, byUnit, byCourseAndUnit, totals: { questions, totalQuestionChars } };
}

export async function getMcqGenerationCountsByCourse(): Promise<Record<string, number>> {
	const stats = await getGenerationStatsForApi();
	return stats.byCourse;
}
