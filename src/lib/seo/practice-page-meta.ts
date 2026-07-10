import type { PracticePage } from '$lib/catalog/practice-pages.js';
import { PRODUCTION_SITE_URL } from '$lib/auth/urls';
import { formatUnitLabel } from '$lib/catalog/practice-pages.js';

const BASE_URL = PRODUCTION_SITE_URL;

function practicePageUrl(slug: string): string {
	return `${BASE_URL}/practice/${slug}`;
}

export function buildPracticePageMeta(page: PracticePage) {
	const url = practicePageUrl(page.slug);
	const { seo } = page;

	return {
		url,
		title: seo.title,
		description: seo.description,
		keywords: seo.keywords ?? '',
		ogTitle: seo.h1,
		ogDescription: seo.description,
		twitterTitle: seo.h1,
		twitterDescription: seo.description
	};
}

export function buildPracticePageJsonLd(page: PracticePage): Record<string, unknown> {
	const meta = buildPracticePageMeta(page);
	const resourceName =
		page.type === 'class'
			? page.seo.h1
			: page.type === 'unit' && page.unitName
				? `${page.className}: ${page.unitName.replace(/^(?:Unit|Big Idea)\s+\d+:\s*/, '')}`
				: page.seo.h1;

	return {
		'@context': 'https://schema.org',
		'@type': 'LearningResource',
		name: resourceName,
		description: meta.description,
		url: meta.url,
		isAccessibleForFree: true,
		educationalLevel: 'High School',
		learningResourceType: 'Practice Quiz',
		inLanguage: 'en-US',
		provider: {
			'@type': 'Organization',
			name: 'Free AP Practice',
			url: BASE_URL
		},
		about: {
			'@type': 'Course',
			name: page.className
		}
	};
}

export function buildPracticeBreadcrumbs(
	page: PracticePage
): Array<{ label: string; href?: string }> {
	const crumbs: Array<{ label: string; href?: string }> = [
		{ label: 'Home', href: '/' },
		{ label: 'Subjects', href: '/subjects' }
	];

	const classSlug = page.slug.split('/')[0]!;
	crumbs.push({
		label: page.className,
		href: page.type === 'class' ? undefined : `/practice/${classSlug}`
	});

	if (page.type === 'unit' && page.unitName) {
		crumbs.push({
			label: formatUnitLabel(page)
		});
	}

	return crumbs;
}

export function buildPracticeBreadcrumbJsonLd(
	page: PracticePage
): Record<string, unknown> {
	const crumbs = buildPracticeBreadcrumbs(page);
	const meta = buildPracticePageMeta(page);

	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.label,
			...(crumb.href ? { item: `${BASE_URL}${crumb.href}` } : { item: meta.url })
		}))
	};
}
