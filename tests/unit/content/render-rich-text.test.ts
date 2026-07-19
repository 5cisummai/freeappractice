import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	isSafeMarkdownUrl,
	normalizeFences,
	renderRichTextHtml
} from '$lib/content/render-rich-text';

const packageJson = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../package.json'), 'utf8')
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

describe('renderRichTextHtml', () => {
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
