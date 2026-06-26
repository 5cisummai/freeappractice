export type BlogEntry = {
	_id: string;
	title: string;
	slug: string;
	excerpt: string;
	content: string;
	coverImage?: string;
	tags: string[];
	author?: string;
	publishedAt?: Date;
	createdAt: Date;
	source: 'file';
};

type ParsedMarkdownPost = {
	title?: string;
	excerpt?: string;
	coverImage?: string;
	tags?: string[];
	author?: string;
	published?: boolean;
	publishedAt?: Date;
	content: string;
};

const markdownFiles = import.meta.glob('/src/content/blog/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

function normalizeSlug(value: string): string {
	const withoutExtension = value
		.trim()
		.toLowerCase()
		.replace(/\.[^.]+$/, '');
	return withoutExtension
		.replace(/[_\s]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function humanizeSlug(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function extractTitleFromMarkdown(content: string): string | undefined {
	const match = content.match(/^#\s+(.+)$/m);
	return match?.[1]?.trim();
}

function summarizeMarkdown(content: string): string {
	const cleaned = content
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^---$/gm, '')
		.replace(/\r/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return '';
	return cleaned.slice(0, 180) + (cleaned.length > 180 ? '…' : '');
}

function parseBoolean(value: string | undefined): boolean | undefined {
	if (!value) return undefined;
	const normalized = value.toLowerCase();
	if (normalized === 'true') return true;
	if (normalized === 'false') return false;
	return undefined;
}

function parseDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseTags(value: string | undefined): string[] | undefined {
	if (!value) return undefined;
	const cleaned = value.replace(/^\[/, '').replace(/\]$/, '');
	const tags = cleaned
		.split(',')
		.map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
	return tags.length > 0 ? tags : undefined;
}

function parseMarkdownPost(raw: string): ParsedMarkdownPost {
	const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
	if (!match) {
		return { content: raw.trim() };
	}

	const [, frontmatterRaw, contentRaw] = match;
	const frontmatter: Record<string, string> = {};
	for (const line of frontmatterRaw.split('\n')) {
		const separator = line.indexOf(':');
		if (separator === -1) continue;
		const key = line.slice(0, separator).trim().toLowerCase();
		const value = line.slice(separator + 1).trim();
		frontmatter[key] = value;
	}

	return {
		title: frontmatter.title,
		excerpt: frontmatter.excerpt,
		coverImage: frontmatter.coverimage ?? frontmatter.cover_image,
		tags: parseTags(frontmatter.tags),
		author: frontmatter.author,
		published: parseBoolean(frontmatter.published),
		publishedAt: parseDate(
			frontmatter.publisheddate ?? frontmatter.published_at ?? frontmatter.date
		),
		content: contentRaw.trim()
	};
}

async function listMarkdownPosts(): Promise<BlogEntry[]> {
	const posts = Object.entries(markdownFiles).map(([filePath, raw]) => {
		const fileName = filePath.split('/').pop() ?? '';
		const parsed = parseMarkdownPost(raw);

		const slugFromFile = normalizeSlug(fileName);
		const published = parsed.published ?? true;
		if (!published || !slugFromFile) return null;

		const title =
			parsed.title?.trim() ||
			extractTitleFromMarkdown(parsed.content) ||
			humanizeSlug(slugFromFile);
		const excerpt = parsed.excerpt?.trim() || summarizeMarkdown(parsed.content);

		const createdAt = parsed.publishedAt ?? new Date();
		const publishedAt = parsed.publishedAt ?? createdAt;

		return {
			_id: `file:${slugFromFile}`,
			title,
			slug: slugFromFile,
			excerpt,
			content: parsed.content,
			...(parsed.coverImage ? { coverImage: parsed.coverImage } : {}),
			tags: parsed.tags ?? [],
			...(parsed.author ? { author: parsed.author } : {}),
			publishedAt,
			createdAt,
			source: 'file' as const
		};
	});

	const validPosts: BlogEntry[] = [];
	for (const post of posts) {
		if (post) validPosts.push(post);
	}

	return validPosts;
}

export async function listPublishedBlogEntries(): Promise<BlogEntry[]> {
	const posts = await listMarkdownPosts();
	return posts.sort((a, b) => {
		const aTime = (a.publishedAt ?? a.createdAt).getTime();
		const bTime = (b.publishedAt ?? b.createdAt).getTime();
		return bTime - aTime;
	});
}

export async function getPublishedBlogEntryBySlug(slug: string): Promise<BlogEntry | null> {
	const normalizedSlug = normalizeSlug(slug);
	if (!normalizedSlug) return null;

	const markdownPosts = await listMarkdownPosts();
	return markdownPosts.find((post) => post.slug === normalizedSlug) ?? null;
}
