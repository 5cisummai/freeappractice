import { error } from '@sveltejs/kit';
import { getPublishedBlogEntryBySlug } from '$lib/server/services/blog';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { markedHighlight } from 'marked-highlight';
import type { PageServerLoad } from './$types';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
	const normalized = url.trim().toLowerCase();
	return (
		normalized.startsWith('http://') ||
		normalized.startsWith('https://') ||
		normalized.startsWith('mailto:') ||
		normalized.startsWith('/') ||
		normalized.startsWith('#')
	);
}

marked.use({
	renderer: {
		html() {
			// Raw HTML in markdown is dropped to prevent script/style/event-handler injection.
			return '';
		},
		link({ href, title, text }) {
			const safeHref = href && isSafeUrl(href) ? href : '#';
			const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
			return `<a href="${escapeHtml(safeHref)}"${safeTitle} rel="noopener noreferrer nofollow">${text}</a>`;
		},
		image({ href, title, text }) {
			if (!href || !isSafeUrl(href)) return '';
			const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
			return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}"${safeTitle} loading="lazy" decoding="async">`;
		}
	}
});

marked.use(
	markedHighlight({
		langPrefix: 'hljs language-',
		highlight(code, lang) {
			const language = hljs.getLanguage(lang) ? lang : 'plaintext';
			return hljs.highlight(code, { language }).value;
		}
	})
);

export const load: PageServerLoad = async ({ params }) => {
	const post = await getPublishedBlogEntryBySlug(params.slug);
	if (!post) error(404, 'Post not found');

	const htmlContent = await marked(post.content);

	return {
		post: {
			_id: post._id,
			title: post.title,
			slug: post.slug,
			excerpt: post.excerpt,
			coverImage: post.coverImage ?? null,
			tags: post.tags,
			publishedAt: post.publishedAt?.toISOString() ?? null,
			createdAt: post.createdAt.toISOString()
		},
		htmlContent
	};
};
