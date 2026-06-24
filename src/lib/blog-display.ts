const DEFAULT_AUTHOR = 'Ajay Saravanan';

const categoryBySlug: Record<string, string> = {
	'which-aps-to-take': 'Course Planning',
	'summer-ap-study-plan': 'Summer Study',
	'science-of-studying': 'Study Skills',
	'subject-specific': 'Exam Prep',
	'stop-studying-harder': 'Study Skills'
};

export function formatBlogDate(iso: string | null): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

export function getBlogAuthor(author?: string | null): string {
	return author?.trim() || DEFAULT_AUTHOR;
}

export function getBlogCategory(slug: string, tags: string[]): string {
	if (tags[0]?.trim()) return tags[0];
	return categoryBySlug[slug] ?? 'AP Prep';
}
