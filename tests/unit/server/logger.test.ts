import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '$lib/server/logger';

describe('structured logger safety boundaries', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('redacts sensitive keys and recognizable secret values recursively', () => {
		const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		logger.info('safe operational event', {
			questionId: 'question-123',
			attemptId: 'attempt-456',
			jobId: 'job-789',
			issue: 42,
			providerRequestId: 'request-abc',
			stripeSubscriptionId: 'sub_secret_123',
			promptTokens: 17,
			completionTokens: 23,
			password: 'correct-horse-battery-staple',
			profile: {
				userId: 'user-raw-id',
				email: 'student@example.com',
				credentials: { authorization: 'Bearer super-secret' }
			},
			secretValue: 'sk-live-secret-value'
		});

		const text = output.mock.calls.flat().join(' ');
		expect(text).toContain('question-123');
		expect(text).toContain('attempt-456');
		expect(text).toContain('job-789');
		expect(text).toContain('request-abc');
		expect(text).toContain('promptTokens');
		expect(text).toContain('completionTokens');
		expect(text).toContain('[REDACTED]');
		expect(text).not.toContain('correct-horse-battery-staple');
		expect(text).not.toContain('user-raw-id');
		expect(text).not.toContain('student@example.com');
		expect(text).not.toContain('super-secret');
		expect(text).not.toContain('sub_secret_123');
		expect(text).not.toContain('sk-live-secret-value');
	});

	it('bounds strings, collections, nesting, errors, and total metadata output', () => {
		const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const deep = { level: { level: { level: { level: { level: { hidden: 'deep-secret' } } } } } };
		const huge = Object.fromEntries(
			Array.from({ length: 40 }, (_, index) => [`field${index}`, 'x'.repeat(600)])
		);

		logger.info('bounded event', {
			longString: 'y'.repeat(600),
			items: Array.from({ length: 40 }, (_, index) => index),
			deep,
			error: Object.assign(new Error('bounded error'), {
				stack: 'stack-line '.repeat(500)
			}),
			huge
		});

		const text = output.mock.calls.flat().join(' ');
		expect(text).toMatch(/truncated|TRUNCATED/);
		expect(text).not.toContain('deep-secret');
		expect(text).not.toContain('y'.repeat(501));
		expect(text).not.toContain('x'.repeat(501));
		expect(text.length).toBeLessThan(12_500);
	});

	it('keeps safe AI operational counts while bounding completion metadata', () => {
		const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const done = logger.aiCall('question-generation', 'model-1');
		done({ promptTokens: 12, completionTokens: 34, outputText: 'generated answer' });

		const text = output.mock.calls.flat().join(' ');
		expect(text).toContain('promptTokens');
		expect(text).toContain('completionTokens');
		expect(text).not.toContain('generated answer');
	});

	it('shows error details under the error key while still redacting top-level message fields', () => {
		const logOutput = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		logger.error('request failed', {
			error: { message: 'database connection refused', code: 'ECONNREFUSED' },
			message: 'student wrote something sensitive'
		});

		const text = [...logOutput.mock.calls, ...errorOutput.mock.calls].flat().join(' ');
		expect(text).toContain('database connection refused');
		expect(text).toContain('ECONNREFUSED');
		expect(text).toContain('[REDACTED]');
		expect(text).not.toContain('student wrote something sensitive');
	});
});
