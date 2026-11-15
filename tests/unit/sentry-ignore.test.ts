import { describe, expect, it } from 'vitest';
import {
	isIgnoredSentryError,
	isSvelteKitMissingRouteNodeError,
	sentryIgnoreErrors
} from '#lib/sentry-ignore.js';

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
		expect(
			isIgnoredSentryError(
				new TypeError("undefined is not an object (evaluating 'someNode.component')")
			)
		).toBe(false);
		expect(isIgnoredSentryError(undefined)).toBe(false);
		expect(isIgnoredSentryError({ message: 'not an error' })).toBe(false);
	});

	it('exports the exact Sentry ignoreErrors substring', () => {
		expect(sentryIgnoreErrors).toContain(
			"undefined is not an object (evaluating 'window.webkit.messageHandlers')"
		);
		expect(sentryIgnoreErrors).toContain('Delay was aborted');
		expect(sentryIgnoreErrors).toContain("Can't find variable: __firefox__");
		expect(sentryIgnoreErrors).toContain('__firefox__ is not defined');
		expect(sentryIgnoreErrors).toContain(
			"undefined is not an object (evaluating 'window.__firefox__.reader"
		);
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

	it('drops Firefox-for-iOS __firefox__ injection noise in Error and string forms', () => {
		expect(isIgnoredSentryError(new ReferenceError("Can't find variable: __firefox__"))).toBe(true);
		expect(isIgnoredSentryError("ReferenceError: Can't find variable: __firefox__")).toBe(true);
		expect(isIgnoredSentryError(new ReferenceError('__firefox__ is not defined'))).toBe(true);
		expect(isIgnoredSentryError('ReferenceError: __firefox__ is not defined')).toBe(true);
	});

	it('keeps first-party Safari missing-variable errors', () => {
		expect(isIgnoredSentryError(new ReferenceError("Can't find variable: practiceSession"))).toBe(
			false
		);
	});

	it('drops Firefox iOS reader-mode window.__firefox__.reader noise in Error and string forms', () => {
		expect(
			isIgnoredSentryError(
				new TypeError("undefined is not an object (evaluating 'window.__firefox__.reader')")
			)
		).toBe(true);
		expect(
			isIgnoredSentryError(
				"TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')"
			)
		).toBe(true);
		expect(
			isIgnoredSentryError(
				new TypeError(
					"undefined is not an object (evaluating 'window.__firefox__.reader.checkReadability')"
				)
			)
		).toBe(true);
	});
});

describe('isSvelteKitMissingRouteNodeError', () => {
	it.each([
		"Cannot read properties of undefined (reading 'component')",
		"Cannot read property 'component' of undefined",
		"undefined is not an object (evaluating 'n.component')",
		"Cannot read properties of undefined (reading 'universal')",
		"Cannot read property 'universal' of undefined",
		"undefined is not an object (evaluating 's.universal')"
	])('matches the SvelteKit route-node crash %s', (message) => {
		expect(isSvelteKitMissingRouteNodeError(new TypeError(message))).toBe(true);
		expect(isSvelteKitMissingRouteNodeError(`TypeError: ${message}`)).toBe(true);
	});

	it('does not treat the crash as ignoreErrors noise', () => {
		expect(
			isIgnoredSentryError(
				new TypeError("Cannot read properties of undefined (reading 'universal')")
			)
		).toBe(false);
		expect(
			isIgnoredSentryError(new TypeError("undefined is not an object (evaluating 's.universal')"))
		).toBe(false);
		expect(
			isIgnoredSentryError(
				new TypeError("Cannot read properties of undefined (reading 'component')")
			)
		).toBe(false);
	});

	it('keeps other undefined property reads', () => {
		expect(
			isSvelteKitMissingRouteNodeError(
				new TypeError("Cannot read properties of undefined (reading 'foo')")
			)
		).toBe(false);
		expect(
			isSvelteKitMissingRouteNodeError(new TypeError('Cannot read properties of undefined'))
		).toBe(false);
		expect(
			isSvelteKitMissingRouteNodeError(
				new TypeError("undefined is not an object (evaluating 'window.__firefox__.reader')")
			)
		).toBe(false);
		expect(
			isSvelteKitMissingRouteNodeError(
				new TypeError("undefined is not an object (evaluating 'someNode')")
			)
		).toBe(false);
	});
});
