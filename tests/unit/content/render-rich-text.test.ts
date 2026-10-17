import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	isSafeMarkdownUrl,
	normalizeFences,
	renderRichTextHtml
} from '#lib/content/render-rich-text.js';

const packageJson = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../package.json'), 'utf8')
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

describe('renderRichTextHtml', () => {
	it('renders explicit citations separately from ordinary links', () => {
		const html = renderRichTextHtml(
			'A claim [cite:search-1]. [Open guide](https://example.com/guide)',
			{
				blocks: true,
				citations: [{ id: 'search-1', url: 'https://example.org/paper', title: 'Research paper' }]
			}
		);
		expect(html).toContain('class="rich-citation"');
		expect(html).toContain('title="Research paper"');
		expect(html).toContain('>example.org</a>');
		expect(html).toContain('>Open guide</a>');
		expect(html.match(/class="rich-citation"/g)).toHaveLength(1);
	});

	it('does not resolve unknown or unsafe citations or citations inside code', () => {
		const html = renderRichTextHtml('[cite:unknown] [cite:unsafe] `[cite:valid]`', {
			citations: [
				{ id: 'unsafe', url: 'javascript:alert(1)', title: 'Unsafe' },
				{ id: 'valid', url: 'https://example.org', title: 'Valid' }
			]
		});
		expect(html).not.toContain('rich-citation');
		expect(html).toContain('[cite:unknown]');
		expect(html).toContain('[cite:unsafe]');
		expect(html).toContain('<code>[cite:valid]</code>');
	});

	it('does not depend on isomorphic-dompurify (jsdom breaks Vercel Lambda require(ESM))', () => {
		expect(packageJson.dependencies?.['isomorphic-dompurify']).toBeUndefined();
		expect(packageJson.devDependencies?.['isomorphic-dompurify']).toBeUndefined();
		expect(() => renderRichTextHtml('hello')).not.toThrow();
	});

	it('drops raw HTML / script injection from markdown', () => {
		const html = renderRichTextHtml('Hello <script>alert(1)</script> **world**');
		expect(html).not.toMatch(/<script[\s>]/i);
		expect(html).toContain('<strong>world</strong>');
	});

	it('drops inline event-handler HTML', () => {
		const html = renderRichTextHtml('Click <img src=x onerror="alert(1)"> here');
		expect(html).not.toMatch(/onerror/i);
		expect(html).not.toContain('<img');
	});

	it('blocks javascript: and data: URLs in links', () => {
		const js = renderRichTextHtml('[x](javascript:alert(1))');
		expect(js).toContain('href="#"');
		expect(js).not.toContain('javascript:');

		const data = renderRichTextHtml(
			'[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'
		);
		expect(data).toContain('href="#"');
		expect(data).not.toContain('data:');
	});

	it('allows safe http(s), mailto, and relative URLs', () => {
		expect(renderRichTextHtml('[docs](https://example.com/a)')).toContain(
			'href="https://example.com/a"'
		);
		expect(renderRichTextHtml('[mail](mailto:a@b.com)')).toContain('href="mailto:a@b.com"');
		expect(renderRichTextHtml('[home](/app)')).toContain('href="/app"');
		expect(isSafeMarkdownUrl('https://freeappractice.org')).toBe(true);
		expect(isSafeMarkdownUrl('javascript:alert(1)')).toBe(false);
	});

	it('adds rel=noopener for external links', () => {
		const html = renderRichTextHtml('[ext](https://example.com)');
		expect(html).toContain('rel="noopener noreferrer nofollow"');
	});

	it('renders fenced code without executing HTML inside the fence', () => {
		const html = renderRichTextHtml('```js\nconst x = "<script>alert(1)</script>";\n```');
		expect(html).toContain('<pre><code class="hljs language-js">');
		expect(html).not.toMatch(/<script>alert/i);
	});

	it('adds a code toolbar when block rendering is enabled', () => {
		const html = renderRichTextHtml('```typescript\nconst answer = 42;\n```', { blocks: true });
		expect(html).toContain('data-rich-code-block');
		expect(html).toContain('data-language="typescript"');
		expect(html).toContain('data-rich-code-action="copy"');
		expect(html).toContain('data-rich-code-action="download"');
		expect(html).toContain('data-rich-code-action="expand"');
		expect(html).toContain('>TypeScript</span>');
		expect(html).not.toContain('rich-code-action-label');
		expect(html).toContain('class="rich-code-line"');
	});

	it('wraps each fenced code line so line numbers align', () => {
		const html = renderRichTextHtml('```text\none\ntwo\nthree\n```', { blocks: true });
		expect(html.match(/class="rich-code-line"/g)).toHaveLength(3);
		expect(html).toContain('data-digits="1"');
	});

	it('keeps highlight spans balanced when a token spans lines', () => {
		const html = renderRichTextHtml('```js\n/* first\nsecond */\nconst x = 1;\n```', {
			blocks: true
		});
		const lines = [...html.matchAll(/<span class="rich-code-line">([\s\S]*?)<\/span>\n?(?=<span class="rich-code-line">|<\/code>)/g)];
		expect(lines).toHaveLength(3);
		for (const [, line] of lines) {
			const opens = (line!.match(/<span/g) ?? []).length;
			const closes = (line!.match(/<\/span>/g) ?? []).length;
			expect(opens).toBe(closes);
		}
	});

	it('renders inline and block math via KaTeX wrappers', () => {
		const inline = renderRichTextHtml('Energy $E=mc^2$ is famous.');
		expect(inline).toContain('math-inline');
		expect(inline).toContain('katex');

		const block = renderRichTextHtml('$$\nx^2\n$$');
		expect(block).toContain('math-block');
		expect(block).toContain('katex');
	});

	it('normalizeFences inserts blank lines around fences', () => {
		expect(normalizeFences('text\n```\ncode\n```\nmore')).toBe('text\n\n```\ncode\n```\n\nmore');
	});
});
