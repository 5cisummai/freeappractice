import { describe, expect, it } from 'vitest';
import {
	formatUnitShortLabel,
	getAllPageSlugs,
	getBrowseCoursesWithUnits,
	getCoursePracticePages,
	getFocusedPracticeHref,
	getPageBySlug,
	getSubjectsBrowsePracticePages,
	getTopicPracticeRedirect
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

describe('getTopicPracticeRedirect', () => {
	it('keeps the original focused-topic redirects', () => {
		expect(getTopicPracticeRedirect('ap-biology/photosynthesis')).toBe('ap-biology/unit-3');
		expect(getTopicPracticeRedirect('ap-world-history/silk-road')).toBe('ap-world-history/unit-2');
	});

	it('rewrites known course aliases onto canonical practice pages', () => {
		expect(getTopicPracticeRedirect('ap-world')).toBe('ap-world-history');
		expect(getTopicPracticeRedirect('ap-world/unit-3')).toBe('ap-world-history/unit-3');
		expect(getTopicPracticeRedirect('ap-physics-c')).toBe('ap-physics-c-mechanics');
		expect(getTopicPracticeRedirect('ap-physics-c/unit-1')).toBe('ap-physics-c-mechanics/unit-1');
		expect(getTopicPracticeRedirect('ap-physics-c/unit-8')).toBe('ap-physics-c-em/unit-8');
	});

	it('does not invent a redirect for unknown or invalid slugs', () => {
		expect(getTopicPracticeRedirect('ap-calculus-ab/unit-99')).toBeNull();
		expect(getTopicPracticeRedirect('ap-pe')).toBeNull();
		expect(getTopicPracticeRedirect('ap-art-and-design/unit-1')).toBeNull();
	});
});
