import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getPostBySlug, updatePost, deletePost } from '$lib/server/services/blog';
import { requireBlogAdminKey } from '$lib/server/blog-admin-auth';
import { logger } from '$lib/server/logger';

const updateSchema = z.object({
	title: z.string().min(3).max(200).optional(),
	excerpt: z.string().min(10).max(500).optional(),
	content: z.string().min(1).optional(),
	coverImage: z.string().url().optional().nullable(),
	tags: z.array(z.string().max(50)).max(10).optional(),
	published: z.boolean().optional()
});

export const GET: RequestHandler = async ({ params }) => {
	try {
		const post = await getPostBySlug(params.slug, true);
		if (!post) return json({ error: 'Not found' }, { status: 404 });
		return json(post);
	} catch (err) {
		logger.error('Blog get error', { error: err });
		return json({ error: 'Failed to fetch post' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		requireBlogAdminKey(event.request);
		const body = await event.request.json();
		const data = updateSchema.parse(body);
		const post = await updatePost(event.params.slug, {
			...data,
			coverImage: data.coverImage ?? undefined
		});
		if (!post) return json({ error: 'Not found' }, { status: 404 });
		return json({ ok: true, slug: post.slug });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return json({ error: 'Validation failed' }, { status: 400 });
		}
		if (err instanceof Response) throw err;
		logger.error('Blog update error', { error: err });
		return json({ error: 'Failed to update post' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		requireBlogAdminKey(event.request);
		const deleted = await deletePost(event.params.slug);
		if (!deleted) return json({ error: 'Not found' }, { status: 404 });
		return json({ ok: true });
	} catch (err) {
		if (err instanceof Response) throw err;
		logger.error('Blog delete error', { error: err });
		return json({ error: 'Failed to delete post' }, { status: 500 });
	}
};
