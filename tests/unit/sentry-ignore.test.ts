import { describe, expect, it } from 'vitest';
import {
	isIgnoredSentryError,
	isUnresolvableStackOverflowError,
	isUnresolvableStackOverflowEvent,
	sentryIgnoreErrors
} from '#lib/sentry-ignore.js';

function rangeErrorWithStack(message: string, stack: string | undefined): RangeError {
	const error = new RangeError(message);
	Object.defineProperty(error, 'stack', { value: stack, configurable: true });
	return error;
}

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

	it('does not ignore stack overflow by message alone', () => {
		expect(sentryIgnoreErrors.some((pattern) => String(pattern).includes('call stack'))).toBe(
			false
		);
		expect(isIgnoredSentryError('RangeError: Maximum call stack size exceeded.')).toBe(false);
	});

	it('drops JSC window.onerror stack overflow with undefined frames', () => {
		expect(
			isIgnoredSentryError(
				rangeErrorWithStack(
					'Maximum call stack size exceeded.',
					'RangeError: Maximum call stack size exceeded.\nundefined:31:70'
				)
			)
		).toBe(true);
		expect(
			isIgnoredSentryError(
				rangeErrorWithStack(
					'Maximum call stack size exceeded.',
					'RangeError: Maximum call stack size exceeded.\n@undefined:31:70'
				)
			)
		).toBe(true);
	});

	it('keeps first-party stack overflow with app frames', () => {
		expect(
			isIgnoredSentryError(
				rangeErrorWithStack(
					'Maximum call stack size exceeded',
					'RangeError: Maximum call stack size exceeded\n    at foo (https://freeappractice.org/_app/immutable/chunks/abc.js:1:234)'
				)
			)
		).toBe(false);
	});
});

describe('isUnresolvableStackOverflowError', () => {
	it('drops empty-stack JSC RangeErrors', () => {
		expect(
			isUnresolvableStackOverflowError(
				rangeErrorWithStack('Maximum call stack size exceeded.', undefined)
			)
		).toBe(true);
	});

	it('keeps other RangeErrors', () => {
		expect(isUnresolvableStackOverflowError(new RangeError('Invalid array length'))).toBe(false);
	});
});

describe('isUnresolvableStackOverflowEvent', () => {
	it('drops events whose only frames are unresolvable', () => {
		expect(
			isUnresolvableStackOverflowEvent({
				exception: {
					values: [
						{
							type: 'RangeError',
							value: 'Maximum call stack size exceeded.',
							stacktrace: {
								frames: [{ filename: 'undefined', abs_path: 'undefined' }]
							}
						}
					]
				}
			})
		).toBe(true);
	});

	it('keeps events with a named third-party or app filename', () => {
		expect(
			isUnresolvableStackOverflowEvent({
				exception: {
					values: [
						{
							type: 'RangeError',
							value: 'Maximum call stack size exceeded.',
							stacktrace: {
								frames: [
									{ filename: 'undefined' },
									{ filename: 'https://accounts.google.com/gsi/client' }
								]
							}
						}
					]
				}
			})
		).toBe(false);
	});

	it('uses the original exception stack when the event has no frames', () => {
		expect(
			isUnresolvableStackOverflowEvent(
				{
					exception: {
						values: [{ type: 'RangeError', value: 'Maximum call stack size exceeded.' }]
					}
				},
				rangeErrorWithStack(
					'Maximum call stack size exceeded.',
					'RangeError: Maximum call stack size exceeded.\n    at recurse (file:///var/task/src/lib/foo.ts:10:3)'
				)
			)
		).toBe(false);
	});
});
