import type { BlogProductCta, BlogRelatedLink } from '#lib/blog/types.js';
import { DEFAULT_BLOG_PRODUCT_CTA } from '#lib/blog/types.js';

const DEFAULT_BLOG_AUTHOR = 'Ajay Saravanan';
const DEFAULT_BLOG_CATEGORY = 'AP Prep';

type BlogEntry = {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	content: string;
	coverImage?: string;
	tags: string[];
	category: string;
	author: string;
	relatedPosts: BlogRelatedLink[];
	productCta: BlogProductCta;
	publishedAt?: Date;
	createdAt: Date;
};

type ParsedMarkdownPost = {
	title?: string;
	excerpt?: string;
	coverImage?: string;
	tags?: string[];
	category?: string;
	author?: string;
	relatedSlugs?: string[];
	ctaHref?: string;
	ctaLabel?: string;
	ctaDescription?: string;
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
		category: frontmatter.category,
		author: frontmatter.author,
		relatedSlugs: parseTags(frontmatter.relatedslugs ?? frontmatter.related_slugs),
		ctaHref: frontmatter.ctahref ?? frontmatter.cta_href,
		ctaLabel: frontmatter.ctalabel ?? frontmatter.cta_label,
		ctaDescription: frontmatter.ctadescription ?? frontmatter.cta_description,
		published: parseBoolean(frontmatter.published),
		publishedAt: parseDate(
			frontmatter.publisheddate ?? frontmatter.published_at ?? frontmatter.date
		),
		content: contentRaw.trim()
	};
}

function parseProductCtaHref(value: string | undefined): BlogProductCta['href'] | undefined {
	if (!value) return undefined;
	const normalized = value.trim();
	if (normalized === 'subjects' || normalized === 'summer' || normalized === '/') return normalized;
	return undefined;
}

function resolveProductCta(parsed: Pick<ParsedMarkdownPost, 'ctaHref' | 'ctaLabel' | 'ctaDescription'>): BlogProductCta {
	const href = parseProductCtaHref(parsed.ctaHref);
	const label = parsed.ctaLabel?.trim();
	const description = parsed.ctaDescription?.trim();
	if (href && label && description) return { href, label, description };
	return DEFAULT_BLOG_PRODUCT_CTA;
}

function buildRelatedPosts(
	relatedSlugs: string[] | undefined,
	titleBySlug: Map<string, string>
): BlogRelatedLink[] {
	if (!relatedSlugs?.length) return [];

	return relatedSlugs
		.map((raw) => normalizeSlug(raw))
		.filter(Boolean)
		.map((slug) => ({
			href: `blog/${slug}` as const,
			label: titleBySlug.get(slug) ?? humanizeSlug(slug)
		}));
}

function listMarkdownPosts(): BlogEntry[] {
	type BlogDraft = Omit<BlogEntry, 'relatedPosts' | 'productCta'> & {
		relatedSlugs?: string[];
		ctaFields: Pick<ParsedMarkdownPost, 'ctaHref' | 'ctaLabel' | 'ctaDescription'>;
	};

	const drafts: BlogDraft[] = [];
	for (const [filePath, raw] of Object.entries(markdownFiles)) {
		const fileName = filePath.split('/').pop() ?? '';
		const parsed = parseMarkdownPost(raw);

		const slugFromFile = normalizeSlug(fileName);
		const published = parsed.published ?? true;
		if (!published || !slugFromFile) continue;

		const title =
			parsed.title?.trim() ||
			extractTitleFromMarkdown(parsed.content) ||
			humanizeSlug(slugFromFile);
		const excerpt = parsed.excerpt?.trim() || summarizeMarkdown(parsed.content);
		const publishedAt = parsed.publishedAt ?? new Date();

		const tags = parsed.tags ?? [];
		const category =
			parsed.category?.trim() || tags[0]?.trim() || DEFAULT_BLOG_CATEGORY;
		const author = parsed.author?.trim() || DEFAULT_BLOG_AUTHOR;

		drafts.push({
			id: `file:${slugFromFile}`,
			title,
			slug: slugFromFile,
			excerpt,
			content: parsed.content,
			...(parsed.coverImage ? { coverImage: parsed.coverImage } : {}),
			tags,
			category,
			author,
			relatedSlugs: parsed.relatedSlugs,
			ctaFields: {
				ctaHref: parsed.ctaHref,
				ctaLabel: parsed.ctaLabel,
				ctaDescription: parsed.ctaDescription
			},
			publishedAt,
			createdAt: publishedAt
		});
	}

	const titleBySlug = new Map(drafts.map((post) => [post.slug, post.title] as const));

	return drafts.map(({ relatedSlugs, ctaFields, ...post }) => ({
		...post,
		relatedPosts: buildRelatedPosts(relatedSlugs, titleBySlug),
		productCta: resolveProductCta(ctaFields)
	}));
}

export function listPublishedBlogEntries(): BlogEntry[] {
	return listMarkdownPosts().sort((a, b) => {
		const aTime = (a.publishedAt ?? a.createdAt).getTime();
		const bTime = (b.publishedAt ?? b.createdAt).getTime();
		return bTime - aTime;
	});
}

export function getPublishedBlogEntryBySlug(slug: string): BlogEntry | null {
	const normalizedSlug = normalizeSlug(slug);
	if (!normalizedSlug) return null;

	return listMarkdownPosts().find((post) => post.slug === normalizedSlug) ?? null;
}
