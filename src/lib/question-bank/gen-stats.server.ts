import { getNeonDatabase } from '$lib/server/neon/db';
import {
	questionGenerationByClass,
	questionGenerationByGlobalUnit,
	questionGenerationByUnit
} from '$lib/server/neon/schema';
export interface GenerationStatsPayload {
	byApClass: Record<string, number>;
	byUnit: Record<string, number>;
	byClassAndUnit: Record<string, Record<string, number>>;
	totals: { questions: number; totalQuestionChars: number };
}

export async function getGenerationStatsForApi(): Promise<GenerationStatsPayload> {
	const db = getNeonDatabase() as any;
	const [classes, units, details] = await Promise.all([
		db.select().from(questionGenerationByClass as any),
		db.select().from(questionGenerationByGlobalUnit as any),
		db.select().from(questionGenerationByUnit as any)
	]);

	const byApClass: Record<string, number> = {};
	let questions = 0;
	let totalQuestionChars = 0;
	for (const row of classes as Array<{
		apClass: string;
		count: number;
		totalQuestionChars: number;
	}>) {
		byApClass[row.apClass] = Number(row.count);
		questions += Number(row.count);
		totalQuestionChars += Number(row.totalQuestionChars);
	}

	const byUnit: Record<string, number> = {};
	for (const row of units as Array<{ unit: string; count: number }>)
		byUnit[row.unit] = Number(row.count);

	const byClassAndUnit: Record<string, Record<string, number>> = {};
	for (const row of details as Array<{ apClass: string; unit: string; count: number }>) {
		(byClassAndUnit[row.apClass] ??= {})[row.unit] = Number(row.count);
	}

	return { byApClass, byUnit, byClassAndUnit, totals: { questions, totalQuestionChars } };
}

export async function getMcqGenerationCountsByClass(): Promise<Record<string, number>> {
	const stats = await getGenerationStatsForApi();
	return stats.byApClass;
}
