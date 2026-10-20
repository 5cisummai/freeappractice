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
		expect(sentryIgnoreErrors).toContain('Delay was aborted');
		expect(sentryIgnoreErrors).toContain('Load failed');
	});

	it('drops Vercel AI SDK abort-during-retry-wait noise', () => {
		expect(isIgnoredSentryError(new DOMException('Delay was aborted', 'AbortError'))).toBe(true);
	});

	it('drops the AI SDK delay abort when Sentry prefixes the type', () => {
		expect(isIgnoredSentryError('AbortError: Delay was aborted')).toBe(true);
	});

	it('keeps other AbortErrors', () => {
		expect(isIgnoredSentryError(new DOMException('The operation was aborted', 'AbortError'))).toBe(
			false
		);
	});

	it('drops Safari fetch Load failed noise', () => {
		expect(isIgnoredSentryError(new TypeError('Load failed'))).toBe(true);
	});

	it('drops the Safari fetch failure when Sentry prefixes the type', () => {
		expect(isIgnoredSentryError('TypeError: Load failed')).toBe(true);
	});

	it('keeps Chrome fetch and first-party Failed to fetch messages', () => {
		expect(isIgnoredSentryError(new TypeError('Failed to fetch'))).toBe(false);
		expect(isIgnoredSentryError(new TypeError('Failed to fetch dynamically imported module'))).toBe(
			false
		);
		expect(isIgnoredSentryError(new Error('Failed to fetch bookmarks'))).toBe(false);
	});
});
