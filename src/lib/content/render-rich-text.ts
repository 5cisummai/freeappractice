import katex from 'katex';
import { Marked, type Token } from 'marked';
import hljs from 'highlight.js';
import { escapeHtml } from '$lib/escape-html';

/** Allowlist for markdown link/image URLs (same policy as blog markdown). */
export function isSafeMarkdownUrl(url: string): boolean {
	const normalized = url.trim().toLowerCase();
	return (
		normalized.startsWith('http://') ||
		normalized.startsWith('https://') ||
		normalized.startsWith('mailto:') ||
		normalized.startsWith('/') ||
		normalized.startsWith('#')
	);
}

function renderKatex(tex: string, displayMode: boolean): string {
	return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' });
}

const blockMathExtension = {
	name: 'blockMath',
	level: 'block' as const,
	start(src: string) {
		const d = src.indexOf('$$');
		const b = src.indexOf('\\[');
		return Math.min(d === -1 ? Infinity : d, b === -1 ? Infinity : b);
	},
	tokenizer(src: string) {
		let match = src.match(/^\$\$([\s\S]+?)\$\$/);
		if (match) return { type: 'blockMath', raw: match[0], tex: match[1].trim() };
		match = src.match(/^\\\[([\s\S]+?)\\\]/);
		if (match) return { type: 'blockMath', raw: match[0], tex: match[1].trim() };
	},
	renderer(token: Token & { tex: string }) {
		return `<div class="math-block">${renderKatex(token.tex, true)}</div>\n`;
	}
};

const inlineMathExtension = {
	name: 'inlineMath',
	level: 'inline' as const,
	start(src: string) {
		const parenIdx = src.indexOf('\\(');
		let dollarIdx = Infinity;
		for (let i = 0; i < src.length; i++) {
			if (src[i] === '$' && src[i + 1] !== '$' && (i === 0 || src[i - 1] !== '$')) {
				dollarIdx = i;
				break;
			}
		}
		const p = parenIdx === -1 ? Infinity : parenIdx;
		return Math.min(dollarIdx, p);
	},
	tokenizer(src: string) {
		let match = src.match(/^\\\(([\s\S]+?)\\\)/);
		if (match) return { type: 'inlineMath', raw: match[0], tex: match[1].trim() };
		match = src.match(/^\$([^$\n][^$\n]*?)\$/);
		if (match && !match[0].startsWith('$$')) {
			return { type: 'inlineMath', raw: match[0], tex: match[1].trim() };
		}
	},
	renderer(token: Token & { tex: string }) {
		return `<span class="math-inline">${renderKatex(token.tex, false)}</span>`;
	}
};

function decodeEntities(str: string): string {
	// Decode &amp; last so sequences like &amp;lt; stay &lt; (single unescape).
	return str
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

/** Ensure fenced code blocks are surrounded by blank lines; normalize newlines. */
export function normalizeFences(src: string): string {
	const normalised = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalised.split('\n');
	const result: string[] = [];
	let inFence = false;
	let fenceChar = '';
	let fenceLen = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (!inFence) {
			const m = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
			if (m) {
				inFence = true;
				fenceChar = m[1]![0]!;
				fenceLen = m[1]!.length;
				if (result.length > 0 && result[result.length - 1]!.trim() !== '') {
					result.push('');
				}
			}
			result.push(line);
		} else {
			result.push(line);
			const closeRe = new RegExp(`^[ \\t]{0,3}\\${fenceChar}{${fenceLen},}[ \\t]*$`);
			if (closeRe.test(line)) {
				inFence = false;
				if (i + 1 < lines.length && lines[i + 1]!.trim() !== '') {
					result.push('');
				}
			}
		}
	}
	return result.join('\n');
}

const markedInstance = new Marked({
	gfm: true,
	breaks: false,
	async: false,
	extensions: [blockMathExtension, inlineMathExtension],
	renderer: {
		html() {
			// Drop raw HTML in markdown — XSS defense without jsdom/DOMPurify.
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
		},
		code({ text: code, lang }: { text: string; lang?: string }) {
			const rawCode = decodeEntities(code);
			const rawLang = (lang ?? '').split(/[:\s]/)[0]!.trim().toLowerCase();
			const validLang = rawLang && hljs.getLanguage(rawLang) ? rawLang : null;

			let highlighted: string;
			try {
				highlighted = validLang
					? hljs.highlight(rawCode, { language: validLang }).value
					: hljs.highlightAuto(rawCode).value;
			} catch {
				highlighted = escapeHtml(rawCode);
			}

			const langClass = validLang ? ` language-${validLang}` : '';
			return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;
		}
	}
});

/**
 * Render practice/tutor markdown to HTML for `{@html}`.
 * Security: deny raw HTML; allowlist link/image URLs; KaTeX/hljs emit trusted HTML.
 * Intentionally avoids isomorphic-dompurify/jsdom (breaks Vercel Lambda require(ESM)).
 */
export function renderRichTextHtml(text: string): string {
	if (!text) return '';
	return markedInstance.parse(normalizeFences(text)) as string;
}
