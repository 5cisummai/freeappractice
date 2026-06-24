export type BlogRelatedLink = {
	href: `/blog/${string}` | '/subjects' | '/summer' | '/';
	label: string;
	description?: string;
};

export type BlogProductCta = {
	href: '/subjects' | '/summer' | '/';
	label: string;
	description: string;
};

const relatedPostsBySlug: Record<string, BlogRelatedLink[]> = {
	'which-aps-to-take': [
		{ href: '/blog/summer-ap-study-plan', label: 'Summer AP study plan' },
		{ href: '/blog/science-of-studying', label: 'The science of studying' }
	],
	'summer-ap-study-plan': [
		{ href: '/blog/which-aps-to-take', label: 'Which APs should you take?' },
		{ href: '/blog/science-of-studying', label: 'The science of studying' }
	],
	'science-of-studying': [
		{ href: '/blog/stop-studying-harder', label: 'Stop studying harder' },
		{ href: '/blog/subject-specific', label: 'Subject-specific study guide' }
	],
	'stop-studying-harder': [
		{ href: '/blog/science-of-studying', label: 'The science of studying' },
		{ href: '/blog/subject-specific', label: 'Subject-specific study guide' }
	],
	'subject-specific': [
		{ href: '/blog/stop-studying-harder', label: 'Stop studying harder' },
		{ href: '/blog/science-of-studying', label: 'The science of studying' }
	]
};

const productCtasBySlug: Record<string, BlogProductCta> = {
	'which-aps-to-take': {
		href: '/subjects',
		label: 'Browse AP subjects',
		description: 'Preview practice hubs for every supported AP class.'
	},
	'summer-ap-study-plan': {
		href: '/summer',
		label: 'Summer AP study guide',
		description: 'Follow the full 4-week Unit 1 preview plan on our summer guide.'
	},
	'science-of-studying': {
		href: '/',
		label: 'Start practicing',
		description: 'Generate unlimited practice questions with instant feedback.'
	},
	'stop-studying-harder': {
		href: '/subjects',
		label: 'Practice by subject',
		description: 'Turn study habits into retrieval practice by AP class.'
	},
	'subject-specific': {
		href: '/subjects',
		label: 'Open subject hubs',
		description: 'Jump to AP-specific practice pages for each course.'
	}
};

export function getBlogRelatedPosts(slug: string): BlogRelatedLink[] {
	return relatedPostsBySlug[slug] ?? [];
}

export function getBlogProductCta(slug: string): BlogProductCta {
	return (
		productCtasBySlug[slug] ?? {
			href: '/',
			label: 'Start practicing',
			description: 'Generate free AP practice questions with instant explanations.'
		}
	);
}
