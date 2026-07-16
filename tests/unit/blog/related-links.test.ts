import { describe, expect, it } from 'vitest';
import { getBlogProductCta, getBlogRelatedPosts } from '$lib/blog/related-links';

describe('blog related links', () => {
	it('returns configured related posts for known slugs', () => {
		const related = getBlogRelatedPosts('science-of-studying');
		expect(related.length).toBeGreaterThan(0);
		expect(related[0]?.href.startsWith('/blog/')).toBe(true);
	});

	it('returns an empty list for unknown slugs', () => {
		expect(getBlogRelatedPosts('missing-post')).toEqual([]);
	});

	it('returns product CTAs with defaults', () => {
		expect(getBlogProductCta('summer-ap-study-plan').href).toBe('/summer');
		expect(getBlogProductCta('missing-post')).toMatchObject({
			href: '/',
			label: 'Start practicing'
		});
	});
});
