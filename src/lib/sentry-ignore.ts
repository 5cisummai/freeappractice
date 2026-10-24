/**
 * Sentry `ignoreErrors` patterns for unactionable third-party noise.
 * String entries use Sentry's partial-match behavior.
 */
export const sentryIgnoreErrors: Array<string | RegExp> = [
	"undefined is not an object (evaluating 'window.webkit.messageHandlers')",
	// Vercel AI SDK delay() when a stream/request abort hits a retry wait.
	'Delay was aborted',
	// Chromium TypeError for failed fetch(). Exact match — a substring would also
	// hide "Failed to fetch dynamically imported module" and first-party copy
	// like "Failed to fetch bookmarks".
	/^(TypeError:\s*)?Failed to fetch$/
];

export function sentryErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return typeof error === 'string' ? error : '';
}

export function isIgnoredSentryError(error: unknown): boolean {
	const message = sentryErrorMessage(error);
	if (!message) return false;

	return sentryIgnoreErrors.some((pattern) =>
		typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)
	);
}
