/**
 * Client-side Sentry `ignoreErrors` patterns for unactionable third-party noise.
 * String entries use Sentry's partial-match behavior.
 *
 * Do not put `Maximum call stack size exceeded` in `ignoreErrors`. That message
 * is also how real first-party recursion is reported. Drop it only when every
 * stack frame is unresolvable (typical iOS/Safari `window.onerror` noise).
 */
export const sentryIgnoreErrors: Array<string | RegExp> = [
	"undefined is not an object (evaluating 'window.webkit.messageHandlers')"
];

const STACK_OVERFLOW_MESSAGE = /^Maximum call stack size exceeded\.?$/i;

const UNRESOLVABLE_FILENAMES = new Set([
	'',
	'undefined',
	'null',
	'<anonymous>',
	'[native code]',
	'?',
	'unknown'
]);

type SentryExceptionLike = {
	type?: string;
	value?: string;
	stacktrace?: {
		frames?: Array<{
			filename?: string | null;
			abs_path?: string | null;
		}>;
	};
};

type SentryErrorEventLike = {
	exception?: {
		values?: SentryExceptionLike[];
	};
};

export function sentryErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return typeof error === 'string' ? error : '';
}

function stackOverflowMessage(value: string): boolean {
	return STACK_OVERFLOW_MESSAGE.test(value.replace(/^RangeError:\s*/i, '').trim());
}

function isResolvableSentryFilename(filename: string | null | undefined): boolean {
	if (filename == null) return false;
	const name = filename.trim();
	if (!name) return false;
	return !UNRESOLVABLE_FILENAMES.has(name.toLowerCase());
}

function stackStringHasResolvableFrame(stack: string): boolean {
	return stack.split('\n').some((line) => {
		const trimmed = line.trim();
		if (!trimmed) return false;
		if (/https?:\/\//i.test(trimmed) || /file:\/\//i.test(trimmed)) return true;
		if (/\/_app\//.test(trimmed)) return true;
		if (/\([^)]+\.[cm]?[jt]sx?:\d+(?::\d+)?\)/.test(trimmed)) return true;
		if (/(?:^|[\s@(])(?:src|node_modules)[/\\]/.test(trimmed)) return true;
		return false;
	});
}

function isRangeErrorStackOverflow(type: string | undefined, value: string | undefined): boolean {
	if (!stackOverflowMessage(value ?? '')) return false;
	return !type || type === 'RangeError';
}

export function isUnresolvableStackOverflowError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if (error.name !== 'RangeError' || !stackOverflowMessage(error.message)) return false;
	const stack = error.stack;
	if (!stack) return true;
	return !stackStringHasResolvableFrame(stack);
}

function exceptionHasResolvableFrame(exception: SentryExceptionLike): boolean {
	const frames = exception.stacktrace?.frames ?? [];
	return frames.some(
		(frame) =>
			isResolvableSentryFilename(frame.filename) || isResolvableSentryFilename(frame.abs_path)
	);
}

export function isUnresolvableStackOverflowEvent(
	event: SentryErrorEventLike,
	originalException?: unknown
): boolean {
	const overflow = (event.exception?.values ?? []).find((value) =>
		isRangeErrorStackOverflow(value.type, value.value)
	);

	if (!overflow) return isUnresolvableStackOverflowError(originalException);

	if (exceptionHasResolvableFrame(overflow)) return false;

	const frames = overflow.stacktrace?.frames ?? [];
	if (frames.length === 0 && originalException instanceof Error) {
		return isUnresolvableStackOverflowError(originalException);
	}

	return true;
}

export function isIgnoredSentryError(error: unknown): boolean {
	if (isUnresolvableStackOverflowError(error)) return true;

	const message = sentryErrorMessage(error);
	if (!message) return false;

	return sentryIgnoreErrors.some((pattern) =>
		typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)
	);
}
