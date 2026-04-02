import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { listPosts, createPost } from '$lib/server/services/blog';
import { requireBlogAdminKey } from '$lib/server/blog-admin-auth';

const createSchema = z.object({
	title: z.string().min(3).max(200),
	slug: z
		.string()
		.min(3)
		.max(200)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase hyphenated'),
	excerpt: z.string().min(10).max(500),
	content: z.string().min(1),
	coverImage: z.string().url().optional(),
	tags: z.array(z.string().max(50)).max(10).optional(),
	published: z.boolean().optional()
});

export const GET: RequestHandler = async () => {
	try {
		const posts = await listPosts(true);
		return json(
			posts.map((p) => ({
				_id: String(p._id),
				title: p.title,
				slug: p.slug,
				excerpt: p.excerpt,
				coverImage: p.coverImage,
				tags: p.tags,
				publishedAt: p.publishedAt,
				createdAt: p.createdAt
			}))
		);
	} catch (err) {
		console.error('Blog list error:', err);
		return json({ error: 'Failed to fetch posts' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		requireBlogAdminKey(event.request);
		const body = await event.request.json();
		const data = createSchema.parse(body);
		const post = await createPost(data);
		return json({ ok: true, slug: post.slug }, { status: 201 });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return json({ error: 'Validation failed', details: err.issues }, { status: 400 });
		}
		if (err instanceof Response) throw err;
		console.error('Blog create error:', err);
		return json({ error: 'Failed to create post' }, { status: 500 });
	}
};
