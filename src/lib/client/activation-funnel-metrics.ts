export type QuestionFailureKind = 'validation' | 'rate_limit' | 'generation' | 'network';

export type LatencyBucket = '0-500ms' | '500-1000ms' | '1-2s' | '2-5s' | '5s+';

export type QuestionSource = 'cached' | 'generated';

export function latencyBucket(ms: number): LatencyBucket {
	if (!Number.isFinite(ms) || ms < 0) return '5s+';
	if (ms < 500) return '0-500ms';
	if (ms < 1000) return '500-1000ms';
	if (ms < 2000) return '1-2s';
	if (ms < 5000) return '2-5s';
	return '5s+';
}

export function classifyQuestionFailure(status: number | null | undefined): QuestionFailureKind {
	if (status == null || status === 0) return 'network';
	if (status === 400 || status === 403 || status === 422) return 'validation';
	if (status === 429) return 'rate_limit';
	if (status >= 500) return 'generation';
	if (status >= 400) return 'validation';
	return 'network';
}

export class QuestionRequestError extends Error {
	readonly status: number | null;
	readonly failureKind: QuestionFailureKind;

	constructor(message: string, status: number | null) {
		super(message);
		this.name = 'QuestionRequestError';
		this.status = status;
		this.failureKind = classifyQuestionFailure(status);
	}
}

export function questionSourceFromCachedFlag(cached: unknown): QuestionSource {
	return cached === true ? 'cached' : 'generated';
}

export function localCalendarDay(date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function daysBetweenCalendarDays(earlier: string, later: string): number {
	const a = Date.parse(`${earlier}T00:00:00`);
	const b = Date.parse(`${later}T00:00:00`);
	if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
	return Math.round((b - a) / 86_400_000);
}
