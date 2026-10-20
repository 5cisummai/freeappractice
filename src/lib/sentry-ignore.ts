/**
 * Sentry `ignoreErrors` patterns for unactionable third-party noise.
 * String entries use Sentry's partial-match behavior.
 */
export const dynamicImportFailureMessages = [
	'Failed to fetch dynamically imported module',
	'Importing a module script failed',
	'error loading dynamically imported module'
] as const;

export const sentryIgnoreErrors: Array<string | RegExp> = [
	"undefined is not an object (evaluating 'window.webkit.messageHandlers')",
	// Vercel AI SDK delay() when a stream/request abort hits a retry wait.
	'Delay was aborted',
	// Browser-native failed import() of hashed SvelteKit chunks (stale tab / network).
	...dynamicImportFailureMessages
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

export function isDynamicImportFailure(error: unknown): boolean {
	const message = sentryErrorMessage(error);
	if (!message) return false;

	return dynamicImportFailureMessages.some((pattern) => message.includes(pattern));
}
