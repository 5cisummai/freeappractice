import { sanitizeAttemptTimeMs } from '$lib/users/attempt-time';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short'
});

export function formatAttemptDate(attemptedAt: string): string {
	if (!attemptedAt) return '';
	return dateFormatter.format(new Date(attemptedAt));
}

export function formatTimeTaken(ms?: number): string | null {
	const sanitized = sanitizeAttemptTimeMs(ms);
	if (sanitized <= 0) return null;
	const seconds = Math.round(sanitized / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const rem = seconds % 60;
	return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
}
