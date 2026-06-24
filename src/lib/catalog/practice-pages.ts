import practicePagesData from '$lib/data/practice-pages.json';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';

type PracticePageLinkKind = 'college-board' | 'subject-tool' | 'blog' | 'external';

type PracticePageLink = {
	label: string;
	href: string;
	kind: PracticePageLinkKind;
};

export type PracticePage = {
	slug: string;
	type: 'class' | 'unit' | 'topic';
	className: string;
	unitName?: string;
	customTopic?: string;
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

		if (page.type === 'topic') {
			if (!page.customTopic?.trim()) {
				throw new Error(`Topic page ${page.slug} missing customTopic`);
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

export function getPageBySlug(slugParam: string): PracticePage | null {
	const normalized = slugParam.replace(/^\/+|\/+$/g, '');
	return pageBySlug.get(normalized) ?? null;
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
	if (page.type === 'topic') return '0.75';
	return '0.7';
}
