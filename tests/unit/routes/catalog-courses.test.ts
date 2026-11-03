import { describe, expect, it } from 'vitest';
import { GET } from '../../../src/routes/api/catalog/courses/+server';

function event(headers: HeadersInit = {}) {
	const setHeaders = (values: Record<string, string>) => {
		for (const [key, value] of Object.entries(values)) {
			responseHeaders.set(key, value);
		}
	};
	const responseHeaders = new Headers();
	return {
		request: new Request('https://example.com/api/catalog/courses', { headers }),
		setHeaders,
		responseHeaders
	};
}

describe('GET /api/catalog/courses', () => {
	it('returns a versioned catalog with cache headers', async () => {
		const { request, setHeaders, responseHeaders } = event();
		const response = await GET({ request, setHeaders } as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.version).toMatch(/^[a-f0-9]{32}$/);
		expect(body.courses.length).toBeGreaterThan(0);
		expect(responseHeaders.get('ETag')).toBe(`"${body.version}"`);
		expect(responseHeaders.get('Cache-Control')).toContain('public');
	});

	it('returns 304 when If-None-Match matches the current version', async () => {
		const first = event();
		const initial = await GET({
			request: first.request,
			setHeaders: first.setHeaders
		} as Parameters<typeof GET>[0]);
		const { version } = await initial.json();

		const second = event({ 'if-none-match': `"${version}"` });
		const response = await GET({
			request: second.request,
			setHeaders: second.setHeaders
		} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(304);
	});
});
