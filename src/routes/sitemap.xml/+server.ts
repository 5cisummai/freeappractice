import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { listPublishedBlogEntries } from '$lib/server/services/blog';

type SitemapEntry = {
	path: string;
	changefreq: 'daily' | 'weekly' | 'monthly';
	priority: string;
};

const entries: SitemapEntry[] = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/blog', changefreq: 'weekly', priority: '0.8' },
	{ path: '/about', changefreq: 'weekly', priority: '0.8' },
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

async function buildSitemapXml(baseUrl: string): Promise<string> {
	// Add dynamic blog posts
	const blogEntries = await listPublishedBlogEntries();
	const dynamicEntries: SitemapEntry[] = blogEntries.map((post) => ({
		path: `/blog/${post.slug}`,
		changefreq: 'weekly',
		priority: '0.6'
	}));

	const allEntries = [...entries, ...dynamicEntries];

	const urls = allEntries
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

export const GET: RequestHandler = async ({ url }) => {
	const sitemap = await buildSitemapXml(getBaseUrl(url));

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};
