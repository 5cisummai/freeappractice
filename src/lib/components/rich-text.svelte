<script lang="ts">
	import katex from 'katex';
	import { Marked, type Token } from 'marked';
	import hljs from 'highlight.js';
	import DOMPurify from 'dompurify';

	let {
		text = '',
		inline = false,
		class: className = ''
	}: {
		text: string;
		inline?: boolean;
		class?: string;
	} = $props();

	// ── KaTeX renderer helper ─────────────────────────────────
	function renderKatex(tex: string, displayMode: boolean): string {
		return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' });
	}

	// ── Marked extension: block math $$ ... $$ and \[ ... \] ──
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

	// ── Marked extension: inline math $ ... $ and \( ... \) ───
	const inlineMathExtension = {
		name: 'inlineMath',
		level: 'inline' as const,
		start(src: string) {
			// Use indexOf for \( since it's unambiguous
			const parenIdx = src.indexOf('\\(');
			// For $, find first single $ (not $$)
			let dollarIdx = Infinity;
			for (let i = 0; i < src.length - 0; i++) {
				if (src[i] === '$' && src[i + 1] !== '$' && (i === 0 || src[i - 1] !== '$')) {
					dollarIdx = i;
					break;
				}
			}
			const p = parenIdx === -1 ? Infinity : parenIdx;
			return Math.min(dollarIdx, p);
		},
		tokenizer(src: string) {
			// \( ... \) takes priority - unambiguous
			let match = src.match(/^\\\(([\s\S]+?)\\\)/);
			if (match) return { type: 'inlineMath', raw: match[0], tex: match[1].trim() };
			// Single $ ... $ - must not be preceded or followed by another $
			match = src.match(/^\$([^$\n][^$\n]*?)\$/);
			if (match && !match[0].startsWith('$$')) {
				return { type: 'inlineMath', raw: match[0], tex: match[1].trim() };
			}
		},
		renderer(token: Token & { tex: string }) {
			return `<span class="math-inline">${renderKatex(token.tex, false)}</span>`;
		}
	};

	// ── Unescape HTML entities that marked injects before our renderer sees the code ──
	// marked (with gfm:true) HTML-escapes code content before calling the renderer.
	// hljs then double-escapes it. We decode first so hljs works on raw source.
	function decodeEntities(str: string): string {
		return str
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");
	}

	// ── Marked instance ───────────────────────────────────────
	const markedInstance = new Marked({
		gfm: true,
		breaks: false,
		async: false,
		extensions: [blockMathExtension, inlineMathExtension],
		renderer: {
			code({ text: code, lang }: { text: string; lang?: string }) {
				// Decode entities injected by marked before highlighting
				const rawCode = decodeEntities(code);

				// Normalise lang: take only the first word/segment before any separator
				const rawLang = (lang ?? '').split(/[:\s]/)[0].trim().toLowerCase();
				const validLang = rawLang && hljs.getLanguage(rawLang) ? rawLang : null;

				let highlighted: string;
				try {
					highlighted = validLang
						? hljs.highlight(rawCode, { language: validLang }).value
						: hljs.highlightAuto(rawCode).value;
				} catch {
					// hljs failed - escape manually and render unstyled
					highlighted = rawCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}

				const langClass = validLang ? ` language-${validLang}` : '';
				return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;
			}
		}
	});

	// ── DOMPurify config ──────────────────────────────────────
	// hljs emits <span class="hljs-*"> inside <code> - we must explicitly
	// allow those tags AND their class attributes, or DOMPurify strips them.
	const DOMPURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
		ADD_TAGS: [
			'pre',
			'code',
			'span',
			'math',
			'annotation',
			'semantics',
			'mrow',
			'mi',
			'mo',
			'mn',
			'msup',
			'msub',
			'mfrac',
			'mspace',
			'mtext',
			'msqrt',
			'mover',
			'munder',
			'mtable',
			'mtr',
			'mtd'
		],
		ADD_ATTR: ['class', 'style', 'aria-hidden', 'encoding'],
		FORBID_TAGS: ['script', 'style'],
		FORBID_ATTR: ['onerror', 'onload', 'onclick'],
		// Prevent DOMPurify from stripping unknown/SVG-namespaced attributes on math elements
		FORCE_BODY: true
	};

	// ── Fence normaliser ──────────────────────────────────────
	// Ensures every fenced code block is surrounded by blank lines.
	// Also normalises \r\n → \n before processing so Windows line-endings
	// don't break the regex logic.
	function normalizeFences(src: string): string {
		// Normalise line endings first
		const normalised = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const lines = normalised.split('\n');
		const result: string[] = [];
		let inFence = false;
		let fenceChar = '';
		let fenceLen = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!inFence) {
				// Match fence openers that start at column 0–3 (commonmark spec)
				const m = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
				if (m) {
					inFence = true;
					fenceChar = m[1][0];
					fenceLen = m[1].length;
					// Ensure blank line before opening fence
					if (result.length > 0 && result[result.length - 1].trim() !== '') {
						result.push('');
					}
				}
				result.push(line);
			} else {
				result.push(line);
				// Closing fence: same char, at least as many chars, optional trailing space
				const closeRe = new RegExp(`^[ \\t]{0,3}\\${fenceChar}{${fenceLen},}[ \\t]*$`);
				if (closeRe.test(line)) {
					inFence = false;
					// Ensure blank line after closing fence
					if (i + 1 < lines.length && lines[i + 1].trim() !== '') {
						result.push('');
					}
				}
			}
		}
		return result.join('\n');
	}

	const renderedHtml = $derived.by(() => {
		if (!text) return '';
		const rawHtml = markedInstance.parse(normalizeFences(text)) as string;
		return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG);
	});
</script>

{#if inline}
	// eslint-disable-next-line svelte/no-at-html-tags
	<span class="rich-text {className}">{@html renderedHtml}</span>
{:else}
	// eslint-disable-next-line svelte/no-at-html-tags
	<div class="rich-text {className}">{@html renderedHtml}</div>
{/if}

<style lang="postcss">
	@reference "../../routes/layout.css";

	.rich-text :global(p) {
		@apply mb-2;
	}
	.rich-text :global(p:last-child) {
		@apply mb-0;
	}
	.rich-text :global(pre) {
		@apply my-2 overflow-x-auto rounded-lg text-[0.8125rem] leading-relaxed;
		padding: 0;
	}
	.rich-text :global(pre code.hljs) {
		border-radius: inherit;
	}
	.rich-text :global(code) {
		@apply font-mono text-[0.8125rem];
	}
	.rich-text :global(:not(pre) > code) {
		@apply rounded px-1.5 py-0.5;
		background: var(--color-muted);
	}
	.rich-text :global(ul) {
		@apply my-1 list-disc pl-6;
	}
	.rich-text :global(ol) {
		@apply my-1 list-decimal pl-6;
	}
	.rich-text :global(li) {
		@apply mb-0.5;
	}
	.rich-text :global(strong) {
		@apply font-semibold;
	}
	.rich-text :global(em) {
		@apply italic;
	}
	.rich-text :global(a) {
		@apply underline underline-offset-2 transition-opacity;
	}
	.rich-text :global(a:hover) {
		@apply opacity-70;
	}
	.rich-text :global(blockquote) {
		@apply my-2 border-l-4 pl-4 italic;
		border-color: var(--color-border);
		color: var(--color-muted-foreground);
	}
	.rich-text :global(h1) {
		@apply mt-4 mb-2 text-2xl font-bold;
	}
	.rich-text :global(h2) {
		@apply mt-3 mb-2 text-xl font-bold;
	}
	.rich-text :global(h3) {
		@apply mt-3 mb-1 text-lg font-semibold;
	}
	.rich-text :global(h4) {
		@apply mt-2 mb-1 text-base font-semibold;
	}
	.rich-text :global(hr) {
		@apply my-4;
		border-color: var(--color-border);
	}
	.rich-text :global(table) {
		@apply my-2 w-full border-collapse text-sm;
	}
	.rich-text :global(th) {
		@apply border px-3 py-1.5 text-left font-semibold;
		background: var(--color-muted);
		border-color: var(--color-border);
	}
	.rich-text :global(td) {
		@apply border px-3 py-1.5;
		border-color: var(--color-border);
	}
	.rich-text :global(.math-block) {
		@apply my-3 overflow-x-auto text-center;
	}
	.rich-text :global(.math-inline) {
		@apply inline;
	}
	.rich-text :global(.katex-display) {
		@apply m-0;
	}
</style>
