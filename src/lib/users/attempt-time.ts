/** Hard ceiling for a single MCQ attempt. Idle/stale tabs can otherwise report multi-day times. */
export const MAX_ATTEMPT_TIME_MS = 30 * 60 * 1000;

/** Normalize client-reported attempt duration before storage or stats aggregation. */
export function sanitizeAttemptTimeMs(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
	return Math.min(Math.round(value), MAX_ATTEMPT_TIME_MS);
}
