/**
 * Sentry `ignoreErrors` patterns for unactionable third-party noise.
 * String entries use Sentry's partial-match behavior.
 */
export const sentryIgnoreErrors: Array<string | RegExp> = [
	"undefined is not an object (evaluating 'window.webkit.messageHandlers')",
	// Vercel AI SDK delay() when a stream/request abort hits a retry wait.
	'Delay was aborted',
	// Firefox-for-iOS / WebKit reader-mode injects `__firefox__` into the page.
	"Can't find variable: __firefox__",
	// Same injected global on Gecko (`ReferenceError: __firefox__ is not defined`).
	'__firefox__ is not defined',
	// Firefox for iOS reader-mode script evaluates window.__firefox__.reader
	// before the injected private global exists (Mozilla bug 1394296).
	// Truncated before the closing quote so `.reader` and `.reader.checkReadability` both match.
	"undefined is not an object (evaluating 'window.__firefox__.reader",
	// Browser ResizeObserver "loop" notification. Engines fire this as
	// window.onerror when a callback mutates layout in the same frame and
	// remaining observations are deferred. Not an application crash.
	// https://crbug.com/809574
	'ResizeObserver loop limit exceeded',
	// Chromium 84+ / Safari wording. Truncated before the trailing period
	// so both punctuated and unpunctuated titles match.
	'ResizeObserver loop completed with undelivered notifications'
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

/** SvelteKit reads `.component` on an undefined route node during a stale or raced navigation. */
export function isSvelteKitMissingComponentError(error: unknown): boolean {
	const message = sentryErrorMessage(error);
	return (
		message.includes("Cannot read properties of undefined (reading 'component')") ||
		message.includes("Cannot read property 'component' of undefined")
	);
}
