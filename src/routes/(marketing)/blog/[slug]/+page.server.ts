import { error } from '@sveltejs/kit';
import { getPublishedBlogEntryBySlug, listPublishedBlogEntries } from '$lib/blog/service.server';
import { getBlogProductCta, getBlogRelatedPosts } from '$lib/blog/related-links.js';
import { renderBlogMarkdown } from '$lib/blog/render-markdown.server';
import type { PageServerLoad } from './$types';

export async function entries() {
	const posts = await listPublishedBlogEntries();
	return posts.map((post) => ({ slug: post.slug }));
}

export const load: PageServerLoad = async ({ params }) => {
	const post = await getPublishedBlogEntryBySlug(params.slug);
	if (!post) error(404, 'Post not found');

	const htmlContent = await renderBlogMarkdown(post.content);

	return {
		post: {
			_id: post._id,
			title: post.title,
			slug: post.slug,
			excerpt: post.excerpt,
			coverImage: post.coverImage ?? null,
			publishedAt: post.publishedAt?.toISOString() ?? null,
			createdAt: post.createdAt.toISOString()
		},
		htmlContent,
		relatedPosts: getBlogRelatedPosts(post.slug),
		productCta: getBlogProductCta(post.slug)
	};
};
