export type BlogRelatedLink = {
	href: `blog/${string}` | 'subjects' | 'summer' | '/';
	label: string;
	description?: string;
};

export type BlogProductCta = {
	href: 'subjects' | 'summer' | '/';
	label: string;
	description: string;
};

export const DEFAULT_BLOG_PRODUCT_CTA: BlogProductCta = {
	href: '/',
	label: 'Start practicing',
	description: 'Generate free AP practice questions with instant explanations.'
};
