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

type RenderCodeBlock = (code: string, lang?: string) => string;

const languageLabels: Record<string, string> = {
	bash: 'Bash',
	css: 'CSS',
	html: 'HTML',
	java: 'Java',
	javascript: 'JavaScript',
	js: 'JavaScript',
	json: 'JSON',
	markdown: 'Markdown',
	md: 'Markdown',
	python: 'Python',
	py: 'Python',
	shell: 'Shell',
	sql: 'SQL',
	svelte: 'Svelte',
	typescript: 'TypeScript',
	ts: 'TypeScript',
	xml: 'XML',
	yaml: 'YAML',
	yml: 'YAML'
};

function createCodeRenderer(blocks: boolean): RenderCodeBlock {
	return (code, lang) => {
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
		if (!blocks) return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;

		const languageCode = rawLang || 'text';
		const languageLabel =
			languageLabels[languageCode] ?? languageCode.charAt(0).toUpperCase() + languageCode.slice(1);
		const safeLanguageCode = escapeHtml(languageCode);
		const safeLanguageLabel = escapeHtml(languageLabel);
		return `<div class="rich-code-block" data-rich-code-block data-language="${safeLanguageCode}">
	<div class="rich-code-toolbar">
		<div class="rich-code-heading">
			<span class="rich-code-icon" aria-hidden="true">&lt;/&gt;</span>
			<span class="rich-code-language">${safeLanguageLabel}</span>
		</div>
		<div class="rich-code-actions">
			<button type="button" class="rich-code-action" data-rich-code-action="copy" aria-label="Copy code" title="Copy code">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
				<span class="sr-only">Copy code</span>
			</button>
			<button type="button" class="rich-code-action" data-rich-code-action="download" aria-label="Download code" title="Download code">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>
				<span class="sr-only">Download code</span>
			</button>
		</div>
	</div>
	<pre><code class="hljs${langClass}">${highlighted}</code></pre>
</div>\n`;
	};
}

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

function createMarkedInstance(blocks: boolean): Marked {
	const renderCode = createCodeRenderer(blocks);

	return new Marked({
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
				return renderCode(code, lang);
			}
		}
	});
}

const markedInstance = createMarkedInstance(false);
const markedBlocksInstance = createMarkedInstance(true);

/**
 * Render practice/tutor markdown to HTML for `{@html}`.
 * Security: deny raw HTML; allowlist link/image URLs; KaTeX/hljs emit trusted HTML.
 * Intentionally avoids isomorphic-dompurify/jsdom (breaks Vercel Lambda require(ESM)).
 */
export function renderRichTextHtml(text: string, options: { blocks?: boolean } = {}): string {
	if (!text) return '';
	const instance = options.blocks ? markedBlocksInstance : markedInstance;
	return instance.parse(normalizeFences(text)) as string;
}
