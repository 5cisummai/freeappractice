import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

type SitemapEntry = {
	path: string;
	changefreq: 'daily' | 'weekly' | 'monthly';
	priority: string;
};

const entries: SitemapEntry[] = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/changelog', changefreq: 'weekly', priority: '0.7' },
	{ path: '/login', changefreq: 'monthly', priority: '0.5' },
	{ path: '/signup', changefreq: 'monthly', priority: '0.5' },
	{ path: '/forgot-password', changefreq: 'monthly', priority: '0.3' },
	{ path: '/reset-password', changefreq: 'monthly', priority: '0.3' },
	{ path: '/verify-email', changefreq: 'monthly', priority: '0.3' },
	{ path: '/email-sent', changefreq: 'monthly', priority: '0.3' },
	{ path: '/privacy', changefreq: 'monthly', priority: '0.4' },
	{ path: '/terms', changefreq: 'monthly', priority: '0.4' }
];

function getBaseUrl(requestUrl: URL): string {
	const configured = env.PUBLIC_BASE_URL ?? env.APP_BASE_URL ?? env.WEBSITE_URL;
	return (configured ?? requestUrl.origin).replace(/\/+$/, '');
}

function buildSitemapXml(baseUrl: string): string {
	const urls = entries
		.map(
			({ path, changefreq, priority }) => `
  <url>
    <loc>${baseUrl}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
		)
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
}

export const GET: RequestHandler = ({ url }) => {
	const sitemap = buildSitemapXml(getBaseUrl(url));

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};