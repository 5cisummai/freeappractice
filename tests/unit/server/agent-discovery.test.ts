import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/site-url', () => ({
	getSiteUrl: (origin?: string) => origin ?? 'https://freeappractice.org'
}));

import {
	buildOAuthAuthorizationServerMetadata,
	buildOAuthProtectedResourceMetadata
} from '$lib/server/agent-discovery/oauth';
import { buildMcpServerCard, mcpServerInfo } from '$lib/server/agent-discovery/mcp';
import { buildApiCatalog } from '$lib/server/agent-discovery/api-catalog';
import { buildHomepageLinkHeader } from '$lib/server/agent-discovery/link-headers';
import { buildAuthMd } from '$lib/server/agent-discovery/auth-md';
import {
	acceptsMarkdown,
	htmlToBasicMarkdown,
	markdownResponse
} from '$lib/server/agent-discovery/markdown';
import { absoluteUrl } from '$lib/server/agent-discovery/site';

const requestUrl = new URL('https://agents.example/path');

describe('agent discovery site helpers', () => {
	it('resolves absolute URLs from the request origin', () => {
		expect(absoluteUrl('/api', requestUrl)).toBe('https://agents.example/api');
		expect(absoluteUrl('health', requestUrl)).toBe('https://agents.example/health');
	});
});

describe('oauth metadata builders', () => {
	it('builds authorization server metadata for Better Auth (not full OAuth2)', () => {
		const meta = buildOAuthAuthorizationServerMetadata(requestUrl);
		expect(meta.issuer).toBe('https://agents.example/');
		expect(meta.authorization_endpoint).toContain('/login');
		expect(meta.grant_types_supported).toEqual([]);
		expect(meta.service_documentation).toContain('/auth.md');
	});

	it('builds protected resource metadata', () => {
		const meta = buildOAuthProtectedResourceMetadata(requestUrl);
		expect(meta.resource).toBe('https://agents.example/api');
		expect(meta.authorization_servers).toEqual(['https://agents.example/']);
	});
});

describe('mcp and api catalog', () => {
	it('exposes server info and an honest empty MCP tool list', () => {
		expect(mcpServerInfo.name).toBe('Free AP Practice');
		const card = buildMcpServerCard(requestUrl);
		expect(card.transport.endpoint).toBe('https://agents.example/api/mcp');
		expect(card.tools).toEqual([]);
		expect(card.status).toBe('unimplemented');
	});

	it('builds the API catalog linkset', () => {
		const catalog = buildApiCatalog(requestUrl);
		expect(catalog.linkset[0]?.anchor).toBe('https://agents.example/api');
		expect(catalog.linkset[0]?.['service-desc']?.[0]?.href).toContain('/openapi.json');
	});
});

describe('homepage link header and auth.md', () => {
	it('returns a stable RFC 8288 link header', () => {
		const header = buildHomepageLinkHeader();
		expect(header).toContain('rel="api-catalog"');
		expect(header).toContain('rel="mcp-server-card"');
	});

	it('includes absolute auth endpoints in auth.md', () => {
		const md = buildAuthMd(requestUrl);
		expect(md).toContain('# auth.md');
		expect(md).toContain('https://agents.example/signup');
		expect(md).toContain('https://agents.example/api/auth/sign-up/email');
	});
});

describe('markdown helpers', () => {
	it('detects markdown Accept headers', () => {
		expect(acceptsMarkdown(new Request('https://example.com'))).toBe(false);
		expect(
			acceptsMarkdown(
				new Request('https://example.com', {
					headers: { accept: 'text/html, text/markdown;q=0.9' }
				})
			)
		).toBe(true);
	});

	it('sets markdown response headers', async () => {
		const response = markdownResponse('# Hi');
		expect(response.headers.get('Content-Type')).toContain('text/markdown');
		expect(response.headers.get('x-markdown-tokens')).toBeTruthy();
		expect(await response.text()).toBe('# Hi');
	});

	it('converts basic HTML into markdown', () => {
		const md = htmlToBasicMarkdown(
			'<html><head><title>Demo</title><meta name="description" content="Desc"></head><body><h1>Hero</h1><h2>Next</h2></body></html>',
			'Fallback'
		);
		expect(md).toContain('# Demo');
		expect(md).toContain('> Desc');
		expect(md).toContain('## Hero');
		expect(md).toContain('## Next');
	});
});
