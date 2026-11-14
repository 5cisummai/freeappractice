import { building, dev } from '$app/env';

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
	"undefined is not an object (evaluating 'window.__firefox__.reader"
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

/**
 * V8/Chrome JavaScript parser hit EOF. Distinct from JSON.parse
 * (`Unexpected end of JSON input`). Typical cause: a truncated or stale
 * `_app/immutable` chunk during hydration or navigation.
 *
 * Match the exact message. `includes('Unexpected end of input')` would also
 * swallow JSON.parse failures.
 */
export function isTruncatedJavaScriptParseError(error: unknown): boolean {
	const message = sentryErrorMessage(error);
	const normalized = message.replace(/^SyntaxError:\s*/u, '').trim();
	return normalized === 'Unexpected end of input';
}

const sentryEnabled = !dev && !building;

export const sentryOptions = {
	dsn: 'https://232093562e45ef93e51f60c4e90108db@o4511759649472512.ingest.us.sentry.io/4511759658909696',
	enabled: sentryEnabled,
	tracesSampleRate: 1,
	enableLogs: true,
	ignoreErrors: sentryIgnoreErrors
};

export { sentryEnabled };
