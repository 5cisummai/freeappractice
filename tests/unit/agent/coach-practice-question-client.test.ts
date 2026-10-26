import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCoachPracticeQuestion } from '#lib/agent/tools/practice.client.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const input = {
	course: 'AP Human Geography',
	unit: 'Unit 2: Population and Migration Patterns and Processes',
	mode: 'mcq' as const
};

const question = {
	kind: 'practice_question' as const,
	mode: 'mcq' as const,
	questionId: 'mcq-1',
	course: input.course,
	unit: input.unit,
	practiceHref: '/app/practice',
	prompt: 'What is a refugee?'
};

describe('fetchCoachPracticeQuestion', () => {
	it('returns a loaded question', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ question }), { status: 200 }))
		);

		await expect(fetchCoachPracticeQuestion(input)).resolves.toMatchObject(question);
	});

	it('keeps retryAfterSeconds only for retryable server responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: 'Question pool is warming up. Please try again shortly.',
							retryAfterSeconds: 15
						}),
						{ status: 503 }
					)
			)
		);

		await expect(fetchCoachPracticeQuestion(input)).resolves.toEqual({
			error: 'Question pool is warming up. Please try again shortly.',
			retryAfterSeconds: 15
		});
	});

	it('does not auto-retry a 400 catalog error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error:
								'"Population and" is not a unit in AP Human Geography. Use the full catalog title, including the "Unit N:" prefix.'
						}),
						{ status: 400 }
					)
			)
		);

		await expect(fetchCoachPracticeQuestion(input)).resolves.toEqual({
			error:
				'"Population and" is not a unit in AP Human Geography. Use the full catalog title, including the "Unit N:" prefix.'
		});
	});

	it('surfaces a Failed to fetch network error instead of hanging', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			})
		);

		await expect(fetchCoachPracticeQuestion(input)).resolves.toEqual({
			error: 'Could not load a practice question. Check your connection and try again.'
		});
	});

	it('reports a timeout using AbortSignal.timeout() native TimeoutError reason', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, init?: RequestInit) => {
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						reject(init.signal?.reason);
					});
				});
			})
		);

		await expect(fetchCoachPracticeQuestion(input, { timeoutMs: 20 })).resolves.toEqual({
			error: 'The practice question took too long to load. Try again.'
		});
	});
});
