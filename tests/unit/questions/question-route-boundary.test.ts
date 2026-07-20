import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestion, capturePathQuestionRequestMetric } = vi.hoisted(() => ({
	getQuestion: vi.fn(),
	capturePathQuestionRequestMetric: vi.fn()
}));

vi.mock('$lib/questions/cache.server', () => ({ getQuestion }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$lib/server/question-request-metrics', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/question-request-metrics')>(
		'$lib/server/question-request-metrics'
	);
	return {
		...actual,
		capturePathQuestionRequestMetric
	};
});

import { POST } from '../../../src/routes/api/question/+server';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readSrc(relativePath: string): string {
	return readFileSync(join(root, relativePath), 'utf8');
}

describe('POST /api/question selection-only boundary', () => {
	beforeEach(() => {
		getQuestion.mockReset();
		capturePathQuestionRequestMetric.mockClear();
	});

	it('returns POOL_WARMING quickly when the pool is empty', async () => {
		getQuestion.mockResolvedValueOnce({ status: 'warming', retryAfterSeconds: 15 });

		const started = Date.now();
		const response = await POST({
			request: new Request('http://localhost/api/question', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					className: 'AP Biology',
					unit: 'Unit 1: Chemistry of Life'
				})
			})
		} as Parameters<typeof POST>[0]);
		const elapsed = Date.now() - started;

		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('15');
		const body = await response.json();
		expect(body).toMatchObject({
			code: 'POOL_WARMING',
			retryAfterSeconds: 15
		});
		expect(elapsed).toBeLessThan(500);
		expect(getQuestion).toHaveBeenCalledOnce();
	});

	it('returns POOL_UNAVAILABLE on DB failure without invoking generation', async () => {
		getQuestion.mockResolvedValueOnce({
			status: 'failed',
			error: new Error('db down')
		});

		const response = await POST({
			request: new Request('http://localhost/api/question', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					className: 'AP Biology',
					unit: 'Unit 1: Chemistry of Life'
				})
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.code).toBe('POOL_UNAVAILABLE');
		expect(getQuestion).toHaveBeenCalledOnce();
	});

	it('returns a pool hit without touching generation modules', async () => {
		getQuestion.mockResolvedValueOnce({
			status: 'found',
			exclusionsReset: false,
			result: {
				answer: {
					question: 'Q?',
					optionA: 'A',
					optionB: 'B',
					optionC: 'C',
					optionD: 'D',
					correctAnswer: 'A',
					explanation: 'E',
					topicsCovered: 't',
					hint1: '',
					hint2: ''
				},
				provider: 'cache',
				model: 'cached',
				cached: true,
				questionId: 'q-hit-1'
			}
		});

		const response = await POST({
			request: new Request('http://localhost/api/question', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					className: 'AP Biology',
					unit: 'Unit 1: Chemistry of Life'
				})
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.questionId).toBe('q-hit-1');
		expect(body.cached).toBe(true);
	});
});

describe('request-path import boundary', () => {
	const forbidden = [
		'generation.server',
		'pool-write.server',
		'cache-miss.server',
		'cache-lock.server'
	];

	const requestPathFiles = [
		'src/routes/api/question/+server.ts',
		'src/routes/api/question/frq/+server.ts',
		'src/lib/questions/cache.server.ts',
		'src/lib/questions/pool.server.ts',
		'src/lib/frq/service.server.ts'
	];

	it('never imports LLM/S3 generation or legacy miss-lock modules', () => {
		for (const file of requestPathFiles) {
			const source = readSrc(file);
			for (const needle of forbidden) {
				expect(source, `${file} must not reference ${needle}`).not.toContain(needle);
			}
			// S3 body reads belong to workers/backfill, not selection
			expect(source, `${file} must not import questions/s3.server`).not.toMatch(
				/from ['"]\$lib\/questions\/s3\.server['"]/
			);
		}
	});

	it('confirms legacy miss-lock files are deleted', () => {
		for (const file of [
			'src/lib/questions/cache-miss.server.ts',
			'src/lib/questions/cache-lock.server.ts',
			'scripts/clear-cache.ts'
		]) {
			expect(() => readSrc(file)).toThrow();
		}
	});
});
