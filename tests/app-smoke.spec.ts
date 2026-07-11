import { expect, test } from '@playwright/test';

const publicSitemapPaths = [
	'/',
	'/changelog',
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/email-sent',
	'/privacy',
	'/terms'
];

test.describe('public app smoke checks', () => {
	test('homepage renders the main marketing surface', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveTitle('Free AP Practice – The Fastest Way to Practice AP Online');
		await expect(
			page.getByRole('heading', { name: 'Master your AP classes with instant practice questions.' })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Generate Question' })).toBeVisible();
		await expect(page.getByText('20+ AP Subjects')).toBeVisible();
	});

	test('public crawl endpoints expose the expected URLs', async ({ request }) => {
		const sitemapResponse = await request.get('/sitemap.xml');
		expect(sitemapResponse.ok()).toBeTruthy();
		expect(sitemapResponse.headers()['content-type']).toMatch(/xml/);

		const sitemap = await sitemapResponse.text();
		for (const path of publicSitemapPaths) {
			expect(sitemap).toContain(`<loc>https://freeappractice.org${path}</loc>`);
		}

		const robotsResponse = await request.get('/robots.txt');
		expect(robotsResponse.ok()).toBeTruthy();
		const robots = await robotsResponse.text();
		expect(robots).toContain('Sitemap: https://freeappractice.org/sitemap.xml');
		expect(robots).toContain('Disallow: /app');
		expect(robots).toContain('Content-Signal: ai-train=no, search=yes, ai-input=yes');
	});

	test('agent discovery endpoints are published', async ({ request }) => {
		const homepage = await request.get('/');
		expect(homepage.ok()).toBeTruthy();
		expect(homepage.headers()['link']).toContain('rel="api-catalog"');

		const apiCatalog = await request.get('/.well-known/api-catalog');
		expect(apiCatalog.ok()).toBeTruthy();
		expect(apiCatalog.headers()['content-type']).toContain('application/linkset+json');
		await expect(apiCatalog.json()).resolves.toMatchObject({
			linkset: [{ anchor: expect.stringContaining('/api') }]
		});

		const oauthAs = await request.get('/.well-known/oauth-authorization-server');
		expect(oauthAs.ok()).toBeTruthy();
		await expect(oauthAs.json()).resolves.toMatchObject({
			issuer: expect.stringContaining('http'),
			authorization_endpoint: expect.stringContaining('/api/auth/')
		});

		const oauthPr = await request.get('/.well-known/oauth-protected-resource');
		expect(oauthPr.ok()).toBeTruthy();
		await expect(oauthPr.json()).resolves.toMatchObject({
			resource: expect.stringContaining('/api'),
			authorization_servers: expect.any(Array)
		});

		const authMd = await request.get('/auth.md');
		expect(authMd.ok()).toBeTruthy();
		expect(authMd.headers()['content-type']).toContain('text/markdown');
		expect(await authMd.text()).toContain('# auth.md');

		const mcpCard = await request.get('/.well-known/mcp/server-card.json');
		expect(mcpCard.ok()).toBeTruthy();
		await expect(mcpCard.json()).resolves.toMatchObject({
			serverInfo: { name: 'Free AP Practice' }
		});

		const skills = await request.get('/.well-known/agent-skills/index.json');
		expect(skills.ok()).toBeTruthy();
		await expect(skills.json()).resolves.toMatchObject({
			$schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
			skills: expect.arrayContaining([
				expect.objectContaining({
					name: expect.any(String),
					digest: expect.stringMatching(/^sha256:/)
				})
			])
		});

		const openapi = await request.get('/openapi.json');
		expect(openapi.ok()).toBeTruthy();
		await expect(openapi.json()).resolves.toMatchObject({
			openapi: '3.1.0',
			paths: { '/health': expect.any(Object) }
		});
	});

	test('homepage supports markdown content negotiation', async ({ request }) => {
		const response = await request.get('/', {
			headers: { Accept: 'text/markdown' }
		});
		expect(response.ok()).toBeTruthy();
		expect(response.headers()['content-type']).toContain('text/markdown');
		expect(response.headers()['x-markdown-tokens']).toBeTruthy();
		const body = await response.text();
		expect(body).toContain('Free AP Practice');
	});

	test('health endpoint returns ok', async ({ request }) => {
		const response = await request.get('/health');
		expect(response.ok()).toBeTruthy();
		await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
	});

	test('login page is marked noindex and renders its form', async ({ page }) => {
		await page.goto('/login');

		await expect(page).toHaveTitle('Login – Free AP Practice');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow'
		);
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
	});

	test('terms and privacy pages render their legal content', async ({ page }) => {
		await page.goto('/terms');
		await expect(page).toHaveTitle('Terms of Service – Free AP Practice');
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://freeappractice.org/terms'
		);
		await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

		await page.goto('/privacy');
		await expect(page).toHaveTitle('Privacy Policy – Free AP Practice');
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://freeappractice.org/privacy'
		);
		await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
	});

	test('changelog page loads release notes', async ({ page }) => {
		await page.goto('/changelog');

		await expect(page).toHaveTitle('Changelog – Free AP Practice');
		await expect(page.getByRole('heading', { name: 'Changelog' })).toBeVisible();
		await expect(page.getByText('1.4.4')).toBeVisible();
	});

	test('history route redirects unauthenticated users to login', async ({ page }) => {
		await page.goto('/app/history');

		await expect(page).toHaveURL(/\/login$/);
	});
});
