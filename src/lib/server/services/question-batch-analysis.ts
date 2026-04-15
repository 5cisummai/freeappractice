import * as s3 from './s3';
import type { StoredQuestion } from './question-storage';
import { getQuestionFromS3 } from './question-storage';

/** Top-level `questions/<uuid>.json` keys only (excludes `questions/users/...`). */
const CANONICAL_QUESTION_KEY =
	/^questions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

export function filterCanonicalQuestionKeys(allKeys: string[]): string[] {
	return allKeys.filter((k) => CANONICAL_QUESTION_KEY.test(k));
}

export function questionIdFromKey(key: string): string {
	const base = key.replace(/^questions\//, '').replace(/\.json$/, '');
	return base;
}

export type PerQuestionAnalysis = Record<string, unknown>;

/**
 * Override or extend this in this file to run custom analytics over each stored question.
 * Default implementation records lightweight aggregates only.
 */
export async function analyzeStoredQuestion(question: StoredQuestion): Promise<PerQuestionAnalysis> {
	const qLen = question.question?.length ?? 0;
	return {
		id: question.id,
		apClass: question.apClass ?? null,
		unit: question.unit ?? null,
		questionCharLength: qLen
	};
}

export interface BatchAnalysisResult {
	canonicalKeys: number;
	loaded: number;
	failed: Array<{ key: string; message: string }>;
	aggregates: {
		byApClass: Record<string, number>;
		byUnit: Record<string, number>;
		totalQuestionChars: number;
	};
	samples: PerQuestionAnalysis[];
}

const BATCH_SIZE = 12;

async function mapInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		const slice = items.slice(i, i + batchSize);
		const part = await Promise.all(slice.map((item) => fn(item)));
		out.push(...part);
	}
	return out;
}

/**
 * Lists all canonical question objects in S3, loads each JSON, and runs `analyzeStoredQuestion` on every one.
 * Results include aggregate counts and the first 50 per-question analysis rows (configurable).
 */
export async function runBatchQuestionAnalysis(opts?: {
	maxSamples?: number;
}): Promise<BatchAnalysisResult> {
	const maxSamples = opts?.maxSamples ?? 50;

	const allKeys = await s3.listAllObjectKeys({ prefix: 'questions/' });
	const keys = filterCanonicalQuestionKeys(allKeys);

	const failed: Array<{ key: string; message: string }> = [];
	const byApClass: Record<string, number> = {};
	const byUnit: Record<string, number> = {};
	let totalQuestionChars = 0;
	const samples: PerQuestionAnalysis[] = [];

	const analyses = await mapInBatches(keys, BATCH_SIZE, async (key) => {
		const id = questionIdFromKey(key);
		try {
			const q = await getQuestionFromS3(id);
			const row = await analyzeStoredQuestion(q);
			const ap = q.apClass ?? '(none)';
			const unit = q.unit ?? '(none)';
			byApClass[ap] = (byApClass[ap] ?? 0) + 1;
			byUnit[unit] = (byUnit[unit] ?? 0) + 1;
			totalQuestionChars += q.question?.length ?? 0;
			if (samples.length < maxSamples) samples.push(row);
			return { ok: true as const };
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			failed.push({ key, message });
			return { ok: false as const };
		}
	});

	const loaded = analyses.filter((a) => a.ok).length;

	return {
		canonicalKeys: keys.length,
		loaded,
		failed,
		aggregates: {
			byApClass,
			byUnit,
			totalQuestionChars
		},
		samples
	};
}
