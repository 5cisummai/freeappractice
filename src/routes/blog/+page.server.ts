import { listPosts } from '$lib/server/services/blog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const posts = await listPosts(true);
	return {
		posts: posts.map((p) => ({
			_id: String(p._id),
			title: p.title,
			slug: p.slug,
			excerpt: p.excerpt,
			coverImage: p.coverImage ?? null,
			tags: p.tags,
			publishedAt: p.publishedAt?.toISOString() ?? null,
			createdAt: p.createdAt.toISOString()
		}))
	};
};
