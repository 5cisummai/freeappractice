import type { RequestHandler } from './$types';
import { listPublishedBlogEntries } from '#lib/blog/service.server.js';
import { getAllPageSlugs, getPageBySlug, getSitemapPriority } from '#lib/catalog/practice-pages.js';
import { getSiteUrl } from '#lib/site-url.js';

export const prerender = true;

type SitemapEntry = {
	path: string;
	changefreq: 'daily' | 'weekly' | 'monthly';
	priority: string;
	lastmod: string;
};

function sitemapDate(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

const buildLastmod = sitemapDate();

const entries: SitemapEntry[] = [
	{ path: '/', changefreq: 'daily', priority: '1.0', lastmod: buildLastmod },
	{ path: '/subjects', changefreq: 'weekly', priority: '0.9', lastmod: buildLastmod },
	{ path: '/practice-tests', changefreq: 'weekly', priority: '0.9', lastmod: buildLastmod },
	{ path: '/blog', changefreq: 'weekly', priority: '0.8', lastmod: buildLastmod },
	{ path: '/summer', changefreq: 'weekly', priority: '0.9', lastmod: buildLastmod },
	{ path: '/stats', changefreq: 'weekly', priority: '0.7', lastmod: buildLastmod },
	{ path: '/about', changefreq: 'weekly', priority: '0.8', lastmod: buildLastmod },
	{ path: '/super', changefreq: 'weekly', priority: '0.9', lastmod: buildLastmod },
	{ path: '/pricing', changefreq: 'weekly', priority: '0.8', lastmod: buildLastmod },
	{ path: '/privacy', changefreq: 'monthly', priority: '0.4', lastmod: buildLastmod },
	{ path: '/terms', changefreq: 'monthly', priority: '0.4', lastmod: buildLastmod }
];

async function buildSitemapXml(baseUrl: string): Promise<string> {
	const blogEntries: SitemapEntry[] = (await listPublishedBlogEntries()).map((post) => ({
		path: `/blog/${post.slug}`,
		changefreq: 'weekly',
		priority: '0.6',
		lastmod: sitemapDate(post.publishedAt ?? post.createdAt)
	}));

	const practiceEntries: SitemapEntry[] = getAllPageSlugs().map((slug) => {
		const page = getPageBySlug(slug);
		return {
			path: `/practice/${slug}`,
			changefreq: 'monthly' as const,
			priority: page ? getSitemapPriority(page) : '0.7',
			lastmod: buildLastmod
		};
	});

	const allEntries = [...entries, ...blogEntries, ...practiceEntries];

	const urls = allEntries
		.map(
			({ path, changefreq, priority, lastmod }) => `
  <url>
    <loc>${baseUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
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
	const sitemap = await buildSitemapXml(getSiteUrl(url.origin));

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};
