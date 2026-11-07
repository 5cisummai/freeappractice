import { error, redirect } from '@sveltejs/kit';
import { getPageBySlug, getTopicPracticeRedirect } from '#lib/catalog/practice-pages.js';
import { getSeoSampleQuestionsForPage } from '#lib/seo/sample-questions.server.js';
import type { PageServerLoad } from './$types';

// Unit samples must reflect live pool retirements in the HTML served to crawlers.
export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	const redirectTo = getTopicPracticeRedirect(params.slug);
	if (redirectTo) {
		redirect(301, `/practice/${redirectTo}`);
	}

	const page = getPageBySlug(params.slug);
	if (!page) {
		error(404, 'Practice page not found');
	}
	return { page, sampleQuestions: await getSeoSampleQuestionsForPage(page) };
};
