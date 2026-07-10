import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostHogProxyRequestInit } from './posthog-proxy';

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

	assert.equal(headers.get('authorization'), null);
	assert.equal(headers.get('connection'), null);
	assert.equal(headers.get('cookie'), null);
	assert.equal(headers.get('forwarded'), null);
	assert.equal(headers.get('proxy-authorization'), null);
	assert.equal(headers.get('referer'), null);
	assert.equal(headers.get('transfer-encoding'), null);
	assert.equal(headers.get('upgrade'), null);
	assert.equal(headers.get('content-type'), 'application/json');
	assert.equal(headers.get('user-agent'), 'posthog-js/1.0');
	assert.equal(headers.get('x-forwarded-for'), '198.51.100.7');
	assert.equal(headers.get('x-real-ip'), null);
});

test('PostHog proxy preserves the request method and streaming body', async () => {
	const request = new Request('https://freeappractice.com/ingest/e/', {
		method: 'POST',
		body: 'analytics payload'
	});

	const init = createPostHogProxyRequestInit(request, null);

	assert.equal(init.method, 'POST');
	assert.equal(await new Response(init.body).text(), 'analytics payload');
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

	assert.equal(init.method, 'GET');
	assert.equal(init.body, null);
	assert.equal(headers.get('accept'), '*/*');
	assert.equal(headers.get('if-none-match'), '"asset-version"');
	assert.equal(headers.get('range'), 'bytes=0-99');
});
