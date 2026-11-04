import { describe, expect, it } from 'vitest';
import {
	formatUnitShortLabel,
	getAllPageSlugs,
	getBrowseCoursesWithUnits,
	getCoursePracticePages,
	getFocusedPracticeHref,
	getPageBySlug,
	getSubjectsBrowsePracticePages
} from '#lib/catalog/practice-pages.js';

describe('getSubjectsBrowsePracticePages', () => {
	it('includes every course hub and leads with high-enrollment subjects', () => {
		const alpha = getCoursePracticePages().map((page) => page.slug);
		const popular = getSubjectsBrowsePracticePages().map((page) => page.slug);
		expect(popular).toHaveLength(alpha.length);
		expect(new Set(popular)).toEqual(new Set(alpha));
		expect(popular.slice(0, 6)).toEqual([
			'ap-biology',
			'ap-us-history',
			'ap-english-language',
			'ap-psychology',
			'ap-world-history',
			'ap-chemistry'
		]);
	});
});

describe('getBrowseCoursesWithUnits', () => {
	it('links every course hub and unit practice page', () => {
		const browse = getBrowseCoursesWithUnits();
		const hrefs = new Set(
			browse.flatMap((course) => [course.href, ...course.units.map((unit) => unit.href)])
		);
		const expected = new Set(getAllPageSlugs().map((slug) => `/practice/${slug}`));
		expect(hrefs).toEqual(expected);
		expect(browse.map((course) => course.slug)).toEqual(
			getSubjectsBrowsePracticePages().map((page) => page.slug)
		);
	});
});

describe('formatUnitShortLabel', () => {
	it('uses the unit number from the slug', () => {
		const page = getPageBySlug('ap-biology/unit-1');
		expect(page).not.toBeNull();
		expect(formatUnitShortLabel(page!)).toBe('Unit 1');
	});
});

describe('getFocusedPracticeHref', () => {
	it('uses the canonical class practice page when no unit is selected', () => {
		expect(getFocusedPracticeHref('AP Biology')).toBe('/practice/ap-biology');
	});

	it('uses the canonical unit practice page when the selected unit exists', () => {
		expect(getFocusedPracticeHref('AP Biology', 'Unit 3: Cellular Energetics')).toBe(
			'/practice/ap-biology/unit-3'
		);
	});

	it('falls back to the class page for an unrecognized unit', () => {
		expect(getFocusedPracticeHref('AP Biology', 'Unit 99: Not a real unit')).toBe(
			'/practice/ap-biology'
		);
	});
});
