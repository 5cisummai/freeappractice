import { BlogPost, type IBlogPost } from '$lib/server/models/blog-post';
import { connectDb } from '$lib/server/db';

export interface BlogPostData {
	title: string;
	slug: string;
	excerpt: string;
	content: string;
	coverImage?: string;
	tags?: string[];
	published?: boolean;
}

export async function listPosts(publishedOnly = true): Promise<IBlogPost[]> {
	await connectDb();
	const filter = publishedOnly ? { published: true } : {};
	return BlogPost.find(filter).sort({ publishedAt: -1, createdAt: -1 }).lean<IBlogPost[]>();
}

export async function getPostBySlug(slug: string, publishedOnly = true): Promise<IBlogPost | null> {
	await connectDb();
	const filter: Record<string, unknown> = { slug };
	if (publishedOnly) filter.published = true;
	return BlogPost.findOne(filter).lean<IBlogPost>();
}

export async function createPost(data: BlogPostData): Promise<IBlogPost> {
	await connectDb();
	const post = new BlogPost({
		...data,
		publishedAt: data.published ? new Date() : undefined
	});
	return post.save();
}

export async function updatePost(
	slug: string,
	data: Partial<BlogPostData>
): Promise<IBlogPost | null> {
	await connectDb();
	const update: Partial<IBlogPost> & { publishedAt?: Date } = { ...data } as Partial<IBlogPost>;
	if (data.published) {
		const existing = await BlogPost.findOne({ slug }).select('publishedAt').lean<IBlogPost>();
		if (!existing?.publishedAt) {
			update.publishedAt = new Date();
		}
	}
	return BlogPost.findOneAndUpdate({ slug }, update, { new: true }).lean<IBlogPost>();
}

export async function deletePost(slug: string): Promise<boolean> {
	await connectDb();
	const result = await BlogPost.deleteOne({ slug });
	return result.deletedCount > 0;
}
