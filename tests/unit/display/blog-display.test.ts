import { describe, expect, it } from 'vitest';
import { formatBlogDate, getBlogAuthor, getBlogCategory } from '$lib/blog-display';

describe('blog-display', () => {
	it('formats ISO dates and falls back for null', () => {
		expect(formatBlogDate(null)).toBe('');
		expect(formatBlogDate('2026-07-15T00:00:00.000Z')).toMatch(/July/);
	});

	it('uses default author when missing', () => {
		expect(getBlogAuthor(null)).toBe('Ajay Saravanan');
		expect(getBlogAuthor('  Casey  ')).toBe('Casey');
	});

	it('prefers tags then slug map then default category', () => {
		expect(getBlogCategory('which-aps-to-take', ['Custom'])).toBe('Custom');
		expect(getBlogCategory('which-aps-to-take', [])).toBe('Course Planning');
		expect(getBlogCategory('unknown-slug', [])).toBe('AP Prep');
	});
});
