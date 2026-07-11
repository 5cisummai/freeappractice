import { error, redirect } from '@sveltejs/kit';
import {
	getAllPageSlugs,
	getPageBySlug,
	getTopicPracticeRedirect,
	getTopicRedirectSlugs
} from '$lib/catalog/practice-pages.js';
import type { PageServerLoad } from './$types';

export function entries() {
	return [...getAllPageSlugs(), ...getTopicRedirectSlugs()].map((slug) => ({ slug }));
}

export const load: PageServerLoad = ({ params }) => {
	const redirectTo = getTopicPracticeRedirect(params.slug);
	if (redirectTo) {
		redirect(301, `/practice/${redirectTo}`);
	}

	const page = getPageBySlug(params.slug);
	if (!page) {
		error(404, 'Practice page not found');
	}
	return { page };
};
