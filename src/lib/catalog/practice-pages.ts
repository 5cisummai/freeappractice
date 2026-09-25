import { PRACTICE_PAGES } from '$lib/data/ap-data';
import { getCourses, getUnitsForCourse } from '$lib/catalog/ap-courses';

type PracticePageLinkKind =
	'college-board' | 'subject-tool' | 'blog' | 'external' | 'internal' | 'practice';

type PracticePageLink = {
	label: string;
	href: string;
	kind: PracticePageLinkKind;
};

type PracticePageFaqItem = {
	id: string;
	question: string;
	answer: string;
};

export type PracticePage = {
	slug: string;
	type: 'course' | 'unit';
	course: string;
	unit?: string;
	seo: {
		title: string;
		description: string;
		keywords?: string;
		h1: string;
		subtitle?: string;
	};
	article: {
		paragraphs: string[];
	};
	links: PracticePageLink[];
	faq: PracticePageFaqItem[];
};

/**
 * Legacy focused-topic SEO URLs → parent unit pages.
 * Kept so old indexable routes redirect instead of 404.
 */
const TOPIC_PRACTICE_REDIRECTS: Record<string, string> = {
	'ap-biology/photosynthesis': 'ap-biology/unit-3',
	'ap-biology/natural-selection': 'ap-biology/unit-7',
	'ap-calculus-ab/limits': 'ap-calculus-ab/unit-1',
	'ap-calculus-ab/derivatives': 'ap-calculus-ab/unit-2',
	'ap-chemistry/stoichiometry': 'ap-chemistry/unit-4',
	'ap-english-language/rhetorical-analysis': 'ap-english-language/unit-1',
	'ap-psychology/memory': 'ap-psychology/unit-2',
	'ap-us-history/constitution': 'ap-us-history/unit-3',
	'ap-us-history/civil-war': 'ap-us-history/unit-5',
	'ap-world-history/silk-road': 'ap-world-history/unit-2'
};

function validatePages(pages: PracticePage[]): void {
	const slugSet = new Set<string>();
	const courses = getCourses();

	for (const page of pages) {
		if (slugSet.has(page.slug)) {
			throw new Error(`Duplicate practice page slug: ${page.slug}`);
		}
		slugSet.add(page.slug);

		const course = courses.find((c) => c.name === page.course);
		if (!course) {
			throw new Error(`Unknown course "${page.course}" for slug ${page.slug}`);
		}

		if (page.type === 'unit') {
			if (!page.unit) {
				throw new Error(`Unit page ${page.slug} missing unit`);
			}
			const units = getUnitsForCourse(page.course);
			if (!units.includes(page.unit)) {
				throw new Error(`Unit "${page.unit}" not found in ${page.course} (slug: ${page.slug})`);
			}
		}

		if (page.type === 'course' && page.unit) {
			throw new Error(`Class page ${page.slug} should not have unit`);
		}
	}
}

const pages = PRACTICE_PAGES as PracticePage[];
validatePages(pages);

const pageBySlug = new Map(pages.map((page) => [page.slug, page]));

const unitsByCourse = new Map<string, PracticePage[]>();

function extractUnitOrder(slug: string): number {
	const match = slug.match(/\/unit-(\d+)$/);
	return match ? Number.parseInt(match[1]!, 10) : 0;
}

for (const page of pages) {
	if (page.type === 'unit') {
		const units = unitsByCourse.get(page.course) ?? [];
		units.push(page);
		unitsByCourse.set(page.course, units);
	}
}

for (const [, units] of unitsByCourse) {
	units.sort((a, b) => extractUnitOrder(a.slug) - extractUnitOrder(b.slug));
}

function getCourseSlugForPage(page: PracticePage): string {
	return page.slug.split('/')[0]!;
}

function getPracticePageHref(page: PracticePage): string {
	return `/practice/${page.slug}`;
}

export function getUnitPagesForCourse(course: string): PracticePage[] {
	return unitsByCourse.get(course) ?? [];
}

export function getCoursePracticePageFor(page: PracticePage): PracticePage | null {
	const classSlug = getCourseSlugForPage(page);
	return pageBySlug.get(classSlug) ?? null;
}

export function getAdjacentUnitPages(page: PracticePage): {
	prev?: PracticePage;
	next?: PracticePage;
} {
	if (page.type !== 'unit') return {};
	const units = getUnitPagesForCourse(page.course);
	const index = units.findIndex((unit) => unit.slug === page.slug);
	if (index < 0) return {};
	return {
		prev: index > 0 ? units[index - 1] : undefined,
		next: index < units.length - 1 ? units[index + 1] : undefined
	};
}

export function formatUnitLabel(page: PracticePage): string {
	if (page.type === 'unit' && page.unit) {
		return page.unit.replace(/^(?:Unit|Big Idea)\s+\d+:\s*/, '');
	}
	return page.seo.h1;
}

export function getCoursePracticePageByCourse(course: string): PracticePage | null {
	return pages.find((page) => page.type === 'course' && page.course === course) ?? null;
}

function getCoursePracticeHref(course: string): string | null {
	const page = getCoursePracticePageByCourse(course);
	return page ? getPracticePageHref(page) : null;
}

/** Returns the canonical public practice page for the current selector state. */
export function getFocusedPracticeHref(course: string, unit?: string): string | null {
	const unitPage = unit
		? getUnitPagesForCourse(course).find((page) => page.unit === unit)
		: undefined;

	return unitPage ? getPracticePageHref(unitPage) : getCoursePracticeHref(course);
}

export function getPageBySlug(slugParam: string): PracticePage | null {
	const normalized = slugParam.replace(/^\/+|\/+$/g, '');
	return pageBySlug.get(normalized) ?? null;
}

export function getTopicPracticeRedirect(slugParam: string): string | null {
	const normalized = slugParam.replace(/^\/+|\/+$/g, '');
	return TOPIC_PRACTICE_REDIRECTS[normalized] ?? null;
}

export function getTopicRedirectSlugs(): string[] {
	return Object.keys(TOPIC_PRACTICE_REDIRECTS);
}

export function getAllPageSlugs(): string[] {
	return pages.map((page) => page.slug);
}

export function getCoursePracticePages(): PracticePage[] {
	return pages
		.filter((page) => page.type === 'course')
		.sort((a, b) => a.course.localeCompare(b.course));
}

export function getSitemapPriority(page: PracticePage): string {
	if (page.type === 'course') return '0.8';
	return '0.7';
}
