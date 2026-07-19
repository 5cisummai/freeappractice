import { listPublishedBlogEntries } from '$lib/blog/service.server';
import { getBlogAuthor } from '$lib/blog-display';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const posts = await listPublishedBlogEntries();
	return {
		posts: posts.map((p) => ({
			_id: p._id,
			title: p.title,
			slug: p.slug,
			excerpt: p.excerpt,
			coverImage: p.coverImage ?? null,
			tags: p.tags,
			author: getBlogAuthor(p.author),
			publishedAt: p.publishedAt?.toISOString() ?? null,
			createdAt: p.createdAt.toISOString()
		}))
	};
};
