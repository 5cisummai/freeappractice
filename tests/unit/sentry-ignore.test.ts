import { describe, expect, it } from 'vitest';
import { isIgnoredSentryError } from '#lib/sentry-ignore.js';

describe('isIgnoredSentryError', () => {
	it('drops iOS WebView webkit messageHandlers noise in Error and string forms', () => {
		expect(
			isIgnoredSentryError(
				new TypeError("undefined is not an object (evaluating 'window.webkit.messageHandlers')")
			)
		).toBe(true);
		expect(
			isIgnoredSentryError(
				"TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers')"
			)
		).toBe(true);
	});

	it('keeps first-party and non-error values', () => {
		expect(
			isIgnoredSentryError(new TypeError("Cannot read properties of undefined (reading 'foo')"))
		).toBe(false);
		expect(isIgnoredSentryError(undefined)).toBe(false);
		expect(isIgnoredSentryError({ message: 'not an error' })).toBe(false);
	});
});
