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

		await expect(page).toHaveTitle('Free AP Practice Questions 2026 - AI-Powered AP Exam Prep');
		await expect(page.getByRole('heading', { name: 'Ace your AP Exams' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Generate Question' })).toBeVisible();
		await expect(page.getByText('20+ AP Subjects')).toBeVisible();
	});

	test('public crawl endpoints expose the expected URLs', async ({ request }) => {
		const sitemapResponse = await request.get('/sitemap.xml');
		expect(sitemapResponse.ok()).toBeTruthy();
		expect(sitemapResponse.headers()['content-type']).toContain('application/xml');

		const sitemap = await sitemapResponse.text();
		for (const path of publicSitemapPaths) {
			expect(sitemap).toContain(`<loc>https://freeappractice.org${path}</loc>`);
		}

		const robotsResponse = await request.get('/robots.txt');
		expect(robotsResponse.ok()).toBeTruthy();
		const robots = await robotsResponse.text();
		expect(robots).toContain('Sitemap: https://freeappractice.org/sitemap.xml');
		expect(robots).toContain('Disallow: /app');
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
		await expect(page.getByText('v1.2.2')).toBeVisible();
	});
});
