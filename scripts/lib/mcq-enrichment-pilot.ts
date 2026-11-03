import { createHash } from 'node:crypto';

export const PILOT_VERSION = 'mcq-enrichment-v1';
export type PilotQuestion = { questionId: string; data: Record<string, unknown> };
export type PilotStep = {
	status: 'proposed' | 'review-needed' | 'failed' | 'skipped';
	model: string;
	version: string;
	proposal?: unknown;
	error?: string;
	usage?: unknown;
	cost?: number;
};
export type PilotRecord = {
	questionId: string;
	fingerprint: string;
	classification?: PilotStep;
	explanation?: PilotStep;
};
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value && typeof value === 'object')
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
			.join(',')}}`;
	return JSON.stringify(value) ?? 'null';
}
export function sourceFingerprint(question: PilotQuestion): string {
	return createHash('sha256').update(canonical(question)).digest('hex');
}
export function selectPilotSample(
	questions: PilotQuestion[],
	units: string[],
	limit: number
): PilotQuestion[] {
	const selected = new Map<string, PilotQuestion>();
	const perUnit = Math.floor(limit / units.length);
	for (const [index, unit] of units.entries()) {
		let count = 0;
		const target = perUnit + (index < limit % units.length ? 1 : 0);
		for (const question of questions
			.filter((q) => q.data.unit === unit)
			.sort((a, b) => a.questionId.localeCompare(b.questionId))) {
			if (count >= target) break;
			if (selected.has(question.questionId)) continue;
			const group = question.data.stimulusId
				? questions.filter((q) => q.data.stimulusId === question.data.stimulusId)
				: [question];
			for (const child of group) {
				if (!selected.has(child.questionId)) {
					selected.set(child.questionId, child);
					if (child.data.unit === unit) count++;
				}
			}
		}
	}
	return [...selected.values()];
}
export function needsVisualContext(question: PilotQuestion): boolean {
	const data = question.data;
	const stimulus = data.stimulus as Record<string, unknown> | undefined;
	return Boolean(
		data.hasDiagram ||
		data.diagramSpec ||
		data.diagram ||
		stimulus?.diagramSpec ||
		stimulus?.diagram
	);
}
export function reusableStep(
	record: PilotRecord | undefined,
	question: PilotQuestion,
	step: 'classification' | 'explanation',
	model: string
): PilotStep | undefined {
	const prior = record?.[step];
	return record?.fingerprint === sourceFingerprint(question) &&
		prior?.model === model &&
		prior.version === PILOT_VERSION &&
		['proposed', 'review-needed', 'skipped'].includes(prior.status)
		? prior
		: undefined;
}
export async function runPilotStep(
	model: string,
	call: () => Promise<{ proposal: { reviewNeeded: boolean }; usage?: unknown }>
): Promise<PilotStep> {
	let error = '';
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const result = await call();
			return {
				status: result.proposal.reviewNeeded ? 'review-needed' : 'proposed',
				model,
				version: PILOT_VERSION,
				...result
			};
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}
	return { status: 'failed', model, version: PILOT_VERSION, error };
}
