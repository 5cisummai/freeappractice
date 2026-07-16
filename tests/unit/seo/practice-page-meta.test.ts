import { describe, expect, it } from 'vitest';
import {
	buildPracticeBreadcrumbJsonLd,
	buildPracticeBreadcrumbs,
	buildPracticePageJsonLd,
	buildPracticePageMeta
} from '$lib/seo/practice-page-meta';
import { getPageBySlug } from '$lib/catalog/practice-pages';

describe('practice page SEO helpers', () => {
	const page = getPageBySlug('ap-biology');
	const unitPage = getPageBySlug('ap-biology/unit-3');

	it('builds page meta from SEO fields', () => {
		expect(page).not.toBeNull();
		const meta = buildPracticePageMeta(page!);
		expect(meta.url).toBe('https://freeappractice.org/practice/ap-biology');
		expect(meta.title).toBe(page!.seo.title);
		expect(meta.description).toBe(page!.seo.description);
	});

	it('builds LearningResource JSON-LD', () => {
		const jsonLd = buildPracticePageJsonLd(page!);
		expect(jsonLd['@type']).toBe('LearningResource');
		expect(jsonLd.isAccessibleForFree).toBe(true);
		expect((jsonLd.about as { name: string }).name).toBe('AP Biology');
	});

	it('builds breadcrumbs and breadcrumb JSON-LD for unit pages', () => {
		expect(unitPage).not.toBeNull();
		const crumbs = buildPracticeBreadcrumbs(unitPage!);
		expect(crumbs[0]).toEqual({ label: 'Home', href: '/' });
		expect(crumbs.some((crumb) => crumb.label === 'AP Biology')).toBe(true);

		const jsonLd = buildPracticeBreadcrumbJsonLd(unitPage!);
		expect(jsonLd['@type']).toBe('BreadcrumbList');
		expect(Array.isArray(jsonLd.itemListElement)).toBe(true);
	});
});
