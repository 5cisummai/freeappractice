import { listPublishedBlogEntries } from '#lib/blog/service.server.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const posts = await listPublishedBlogEntries();
	return {
		posts: posts.map((p) => ({
			id: p.id,
			title: p.title,
			slug: p.slug,
			excerpt: p.excerpt,
			coverImage: p.coverImage ?? null,
			tags: p.tags,
			category: p.category,
			author: p.author,
			publishedAt: p.publishedAt?.toISOString() ?? null,
			createdAt: p.createdAt.toISOString()
		}))
	};
};
