import { connectDb } from '$lib/server/db';
import {
	QuestionGenClassTotal,
	QuestionGenUnitDetail,
	QuestionGenUnitGlobal
} from '$lib/server/models/question-generation-stats';
import { normalizeUnit } from '$lib/server/utils';

export function normalizeUnitLabel(unit?: string | null): string {
	return normalizeUnit(unit, '(none)');
}

/**
 * Call after a new MCQ is written to S3. Updates class totals, per-class unit rows,
 * and global unit rollup (same labels across courses are summed in global).
 */
export async function recordMcqGenerated(opts: {
	apClass: string;
	unit?: string | null;
	questionText: string;
}): Promise<void> {
	await connectDb();
	const unit = normalizeUnitLabel(opts.unit);
	const len = opts.questionText.length;

	await Promise.all([
		QuestionGenClassTotal.findOneAndUpdate(
			{ apClass: opts.apClass },
			{ $inc: { count: 1, totalQuestionChars: len } },
			{ upsert: true, returnDocument: 'after' }
		).exec(),
		QuestionGenUnitDetail.findOneAndUpdate(
			{ apClass: opts.apClass, unit },
			{ $inc: { count: 1, totalQuestionChars: len } },
			{ upsert: true, returnDocument: 'after' }
		).exec(),
		QuestionGenUnitGlobal.findOneAndUpdate(
			{ unit },
			{ $inc: { count: 1, totalQuestionChars: len } },
			{ upsert: true, returnDocument: 'after' }
		).exec()
	]);
}

export interface GenerationStatsPayload {
	byApClass: Record<string, number>;
	byUnit: Record<string, number>;
	byClassAndUnit: Record<string, Record<string, number>>;
	totals: {
		questions: number;
		totalQuestionChars: number;
	};
}

export async function getGenerationStatsForApi(): Promise<GenerationStatsPayload> {
	await connectDb();

	const [classes, unitGlobals, unitDetails] = await Promise.all([
		QuestionGenClassTotal.find().lean().exec(),
		QuestionGenUnitGlobal.find().lean().exec(),
		QuestionGenUnitDetail.find().lean().exec()
	]);

	const byApClass: Record<string, number> = {};
	for (const row of classes) {
		byApClass[row.apClass] = row.count;
	}

	const byUnit: Record<string, number> = {};
	for (const row of unitGlobals) {
		byUnit[row.unit] = row.count;
	}

	const byClassAndUnit: Record<string, Record<string, number>> = {};
	for (const row of unitDetails) {
		if (!byClassAndUnit[row.apClass]) byClassAndUnit[row.apClass] = {};
		byClassAndUnit[row.apClass][row.unit] = row.count;
	}

	let questions = 0;
	let totalQuestionChars = 0;
	for (const row of classes) {
		questions += row.count;
		totalQuestionChars += row.totalQuestionChars;
	}

	return {
		byApClass,
		byUnit,
		byClassAndUnit,
		totals: { questions, totalQuestionChars }
	};
}
