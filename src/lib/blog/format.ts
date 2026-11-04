export function formatBlogDate(iso: string | null): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
