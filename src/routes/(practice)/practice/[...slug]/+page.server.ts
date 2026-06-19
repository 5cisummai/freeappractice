import { error } from '@sveltejs/kit';
import { getAllPageSlugs, getPageBySlug } from '$lib/practice-pages.js';
import type { PageServerLoad } from './$types';

export const prerender = true;

export function entries() {
	return getAllPageSlugs().map((slug) => ({ slug }));
}

export const load: PageServerLoad = ({ params }) => {
	const page = getPageBySlug(params.slug);
	if (!page) {
		error(404, 'Practice page not found');
	}
	return { page };
};
