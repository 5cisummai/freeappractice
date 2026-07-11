import practicePagesData from '$lib/data/practice-pages.json';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';

type PracticePageLinkKind =
	| 'college-board'
	| 'subject-tool'
	| 'blog'
	| 'external'
	| 'internal'
	| 'practice';

type PracticePageLink = {
	label: string;
	href: string;
	kind: PracticePageLinkKind;
};

export type PracticePage = {
	slug: string;
	type: 'class' | 'unit';
	className: string;
	unitName?: string;
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
};

/**
 * Legacy focused-topic SEO URLs → parent unit pages.
 * Kept so old indexable routes redirect instead of 404.
 */
export const TOPIC_PRACTICE_REDIRECTS: Record<string, string> = {
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

		const course = courses.find((c) => c.name === page.className);
		if (!course) {
			throw new Error(`Unknown className "${page.className}" for slug ${page.slug}`);
		}

		if (page.type === 'unit') {
			if (!page.unitName) {
				throw new Error(`Unit page ${page.slug} missing unitName`);
			}
			const units = getUnitsForClass(page.className);
			if (!units.includes(page.unitName)) {
				throw new Error(
					`Unit "${page.unitName}" not found in ${page.className} (slug: ${page.slug})`
				);
			}
		}

		if (page.type === 'class' && page.unitName) {
			throw new Error(`Class page ${page.slug} should not have unitName`);
		}
	}
}

const pages = (practicePagesData.pages ?? []) as PracticePage[];
validatePages(pages);

const pageBySlug = new Map(pages.map((page) => [page.slug, page]));

const pagesByClass = new Map<string, PracticePage[]>();
const unitsByClass = new Map<string, PracticePage[]>();

function extractUnitOrder(slug: string): number {
	const match = slug.match(/\/unit-(\d+)$/);
	return match ? Number.parseInt(match[1]!, 10) : 0;
}

for (const page of pages) {
	const list = pagesByClass.get(page.className) ?? [];
	list.push(page);
	pagesByClass.set(page.className, list);

	if (page.type === 'unit') {
		const units = unitsByClass.get(page.className) ?? [];
		units.push(page);
		unitsByClass.set(page.className, units);
	}
}

for (const [, units] of unitsByClass) {
	units.sort((a, b) => extractUnitOrder(a.slug) - extractUnitOrder(b.slug));
}

export function getClassSlugForPage(page: PracticePage): string {
	return page.slug.split('/')[0]!;
}

export function getPracticePageHref(page: PracticePage): string {
	return `/practice/${page.slug}`;
}

export function getPagesByClass(className: string): PracticePage[] {
	return pagesByClass.get(className) ?? [];
}

export function getUnitPagesForClass(className: string): PracticePage[] {
	return unitsByClass.get(className) ?? [];
}

export function getClassPracticePageFor(page: PracticePage): PracticePage | null {
	const classSlug = getClassSlugForPage(page);
	return pageBySlug.get(classSlug) ?? null;
}

export function getAdjacentUnitPages(page: PracticePage): {
	prev?: PracticePage;
	next?: PracticePage;
} {
	if (page.type !== 'unit') return {};
	const units = getUnitPagesForClass(page.className);
	const index = units.findIndex((unit) => unit.slug === page.slug);
	if (index < 0) return {};
	return {
		prev: index > 0 ? units[index - 1] : undefined,
		next: index < units.length - 1 ? units[index + 1] : undefined
	};
}

export function formatUnitLabel(page: PracticePage): string {
	if (page.type === 'unit' && page.unitName) {
		return page.unitName.replace(/^(?:Unit|Big Idea)\s+\d+:\s*/, '');
	}
	return page.seo.h1;
}

export function getClassPracticePageByClassName(className: string): PracticePage | null {
	return pages.find((page) => page.type === 'class' && page.className === className) ?? null;
}

export function getClassPracticeHref(className: string): string | null {
	const page = getClassPracticePageByClassName(className);
	return page ? getPracticePageHref(page) : null;
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

export function getClassPracticePages(): PracticePage[] {
	return pages
		.filter((page) => page.type === 'class')
		.sort((a, b) => a.className.localeCompare(b.className));
}

export function getSitemapPriority(page: PracticePage): string {
	if (page.type === 'class') return '0.8';
	return '0.7';
}
