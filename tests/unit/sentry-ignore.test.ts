import { describe, expect, it } from 'vitest';
import { isIgnoredSentryError, sentryIgnoreErrors } from '#lib/sentry-ignore.js';

describe('isIgnoredSentryError', () => {
	it('drops iOS WebView webkit messageHandlers noise', () => {
		expect(
			isIgnoredSentryError(
				new TypeError("undefined is not an object (evaluating 'window.webkit.messageHandlers')")
			)
		).toBe(true);
	});

	it('drops the same noise when Sentry prefixes the type', () => {
		expect(
			isIgnoredSentryError(
				"TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers')"
			)
		).toBe(true);
	});

	it('keeps first-party TypeErrors', () => {
		expect(
			isIgnoredSentryError(new TypeError("Cannot read properties of undefined (reading 'foo')"))
		).toBe(false);
	});

	it('keeps empty and non-error values', () => {
		expect(isIgnoredSentryError(undefined)).toBe(false);
		expect(isIgnoredSentryError({ message: 'not an error' })).toBe(false);
	});

	it('exports the exact Sentry ignoreErrors substring', () => {
		expect(sentryIgnoreErrors).toContain(
			"undefined is not an object (evaluating 'window.webkit.messageHandlers')"
		);
	});
});
