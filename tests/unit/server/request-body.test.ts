import { describe, expect, it } from 'vitest';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';

describe('bounded JSON request bodies', () => {
	it('parses a body within the limit', async () => {
		await expect(
			readJsonBody(
				new Request('http://localhost', {
					method: 'POST',
					body: JSON.stringify({ message: 'hello' })
				}),
				1000
			)
		).resolves.toEqual({ message: 'hello' });
	});

	it('rejects a declared body before reading it', async () => {
		const request = new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-length': '101' },
			body: 'x'
		});

		await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
	});

	it('rejects a streamed body that exceeds the limit', async () => {
		const request = new Request('http://localhost', {
			method: 'POST',
			body: 'x'.repeat(101)
		});

		await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
	});
});
