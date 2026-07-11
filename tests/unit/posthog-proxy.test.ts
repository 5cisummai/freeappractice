import { expect, test } from 'vitest';
import { createPostHogProxyRequestInit } from '$lib/server/posthog-proxy';

test('PostHog proxy drops credentials and hop-by-hop headers', () => {
	const request = new Request('https://freeappractice.com/ingest/e/', {
		method: 'POST',
		headers: {
			authorization: 'Bearer secret',
			connection: 'keep-alive',
			cookie: 'session=secret',
			forwarded: 'for=203.0.113.11',
			'content-type': 'application/json',
			'proxy-authorization': 'Basic secret',
			referer: 'https://freeappractice.com/private/path',
			'transfer-encoding': 'chunked',
			upgrade: 'websocket',
			'user-agent': 'posthog-js/1.0',
			'x-forwarded-for': '203.0.113.10',
			'x-real-ip': '203.0.113.12'
		},
		body: JSON.stringify({ event: '$pageview' })
	});

	const init = createPostHogProxyRequestInit(request, '198.51.100.7');
	const headers = new Headers(init.headers);

	expect(headers.get('authorization')).toBeNull();
	expect(headers.get('connection')).toBeNull();
	expect(headers.get('cookie')).toBeNull();
	expect(headers.get('forwarded')).toBeNull();
	expect(headers.get('proxy-authorization')).toBeNull();
	expect(headers.get('referer')).toBeNull();
	expect(headers.get('transfer-encoding')).toBeNull();
	expect(headers.get('upgrade')).toBeNull();
	expect(headers.get('content-type')).toBe('application/json');
	expect(headers.get('user-agent')).toBe('posthog-js/1.0');
	expect(headers.get('x-forwarded-for')).toBe('198.51.100.7');
	expect(headers.get('x-real-ip')).toBeNull();
});

test('PostHog proxy preserves the request method and streaming body', async () => {
	const request = new Request('https://freeappractice.com/ingest/e/', {
		method: 'POST',
		body: 'analytics payload'
	});

	const init = createPostHogProxyRequestInit(request, null);

	expect(init.method).toBe('POST');
	expect(await new Response(init.body).text()).toBe('analytics payload');
});

test('PostHog proxy preserves safe asset request headers', () => {
	const request = new Request('https://freeappractice.com/ingest/static/array.js', {
		headers: {
			accept: '*/*',
			'if-none-match': '"asset-version"',
			range: 'bytes=0-99'
		}
	});

	const init = createPostHogProxyRequestInit(request, null);
	const headers = new Headers(init.headers);

	expect(init.method).toBe('GET');
	expect(init.body).toBeNull();
	expect(headers.get('accept')).toBe('*/*');
	expect(headers.get('if-none-match')).toBe('"asset-version"');
	expect(headers.get('range')).toBe('bytes=0-99');
});
