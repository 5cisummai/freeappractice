import { marked } from 'marked';
import hljs from 'highlight.js';
import { markedHighlight } from 'marked-highlight';
import { escapeHtml } from '$lib/escape-html';
import { isSafeMarkdownUrl } from '$lib/content/render-rich-text';

let configured = false;

function ensureMarkedConfigured(): void {
	if (configured) return;
	configured = true;

	marked.use({
		renderer: {
			html() {
				// Raw HTML in markdown is dropped to prevent script/style/event-handler injection.
				return '';
			},
			link({ href, title, text }) {
				const safeHref = href && isSafeMarkdownUrl(href) ? href : '#';
				const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
				const isInternal = safeHref.startsWith('/') || safeHref.startsWith('#');
				const rel = isInternal ? undefined : 'noopener noreferrer nofollow';
				const relAttr = rel ? ` rel="${rel}"` : '';
				return `<a href="${escapeHtml(safeHref)}"${safeTitle}${relAttr}>${text}</a>`;
			},
			image({ href, title, text }) {
				if (!href || !isSafeMarkdownUrl(href)) return '';
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
}

/** Render blog markdown to sanitized HTML (no raw HTML; safe link/image URLs only). */
export async function renderBlogMarkdown(content: string): Promise<string> {
	ensureMarkedConfigured();
	return marked(content);
}
