import { formatUnitLabel, type PracticePage } from '#lib/catalog/practice-pages.js';
import { PRODUCTION_SITE_URL } from '#lib/site-url.js';

const BASE_URL = PRODUCTION_SITE_URL;
const TITLE_MAX_LENGTH = 60;

function practicePageUrl(slug: string): string {
	return `${BASE_URL}/practice/${slug}`;
}

function firstFittingTitle(candidates: string[]): string {
	return candidates.find((title) => title.length <= TITLE_MAX_LENGTH) ?? candidates.at(-1)!;
}

function physicsCQualifier(course: string): string | null {
	const match = /^AP Physics C: (.+)$/.exec(course);
	return match?.[1] ?? null;
}

function seoCourseName(course: string): string {
	return physicsCQualifier(course) ? 'AP Physics C' : course;
}

function seoUnitName(page: PracticePage): string {
	const unitName = formatUnitLabel(page);
	const qualifier = physicsCQualifier(page.course);
	return qualifier ? `${qualifier}: ${unitName}` : unitName;
}

function unitNumberFromPage(page: PracticePage): number | null {
	const fromSlug = /\/unit-(\d+)$/.exec(page.slug);
	if (fromSlug) return Number.parseInt(fromSlug[1]!, 10);

	const fromLabel = /^(?:Unit|Big Idea)\s+(\d+):/.exec(page.unit ?? '');
	if (fromLabel) return Number.parseInt(fromLabel[1]!, 10);

	return null;
}

function buildCourseSeoCopy(page: PracticePage): {
	title: string;
	description: string;
	h1: string;
} {
	return {
		title: firstFittingTitle([
			`Free ${page.course} Practice Questions by Unit`,
			`Free ${page.course} Practice Questions`
		]),
		description: `Free ${page.course} practice tests for every unit. Unlimited AP-style MCQs with instant explanations. No signup, start in 2 clicks.`,
		h1: `Free ${page.course} Practice Questions`
	};
}

function buildUnitSeoCopy(page: PracticePage): { title: string; description: string; h1: string } {
	const unitNumber = unitNumberFromPage(page);
	if (unitNumber == null) {
		return {
			title: page.seo.title,
			description: page.seo.description,
			h1: page.seo.h1
		};
	}

	const courseName = seoCourseName(page.course);
	const unitName = seoUnitName(page);

	return {
		title: firstFittingTitle([
			`${courseName} Unit ${unitNumber}: ${unitName} Practice`,
			`${courseName} Unit ${unitNumber} Practice: ${unitName}`,
			`${courseName} Unit ${unitNumber} Practice Questions (Free)`,
			`${courseName} Unit ${unitNumber} Practice Questions`
		]),
		description: `Free ${courseName} Unit ${unitNumber} practice questions on ${unitName}. Unlimited AP-style MCQs with instant explanations. No signup.`,
		h1: `${courseName} Unit ${unitNumber}: ${unitName}`
	};
}

export function buildPracticePageSeoCopy(page: PracticePage): {
	title: string;
	description: string;
	h1: string;
} {
	switch (page.type) {
		case 'course':
			return buildCourseSeoCopy(page);
		case 'unit':
			return buildUnitSeoCopy(page);
		default: {
			const exhaustive: never = page.type;
			return exhaustive;
		}
	}
}

export function buildPracticePageMeta(page: PracticePage) {
	const url = practicePageUrl(page.slug);
	const { seo } = page;
	const copy = buildPracticePageSeoCopy(page);

	return {
		url,
		title: copy.title,
		description: copy.description,
		h1: copy.h1,
		keywords: seo.keywords ?? '',
		ogTitle: copy.title,
		ogDescription: copy.description,
		twitterTitle: copy.title,
		twitterDescription: copy.description
	};
}

export function buildPracticePageJsonLd(page: PracticePage): Record<string, unknown> {
	const meta = buildPracticePageMeta(page);
	const resourceName =
		page.type === 'unit' && page.unit
			? `${page.course}: ${formatUnitLabel(page)}`
			: formatUnitLabel(page);

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
			name: page.course
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
		label: page.course,
		href: page.type === 'course' ? undefined : `/practice/${classSlug}`
	});

	if (page.type === 'unit' && page.unit) {
		crumbs.push({
			label: formatUnitLabel(page)
		});
	}

	return crumbs;
}

export function buildPracticeBreadcrumbJsonLd(page: PracticePage): Record<string, unknown> {
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

export function buildPracticeFaqJsonLd(page: PracticePage): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: page.faq.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer
			}
		}))
	};
}
