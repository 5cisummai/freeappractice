import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveSharedQuizForUser } from '#lib/shared-practice/shared-sets.server.js';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const result = await resolveSharedQuizForUser(
		params.slug,
		locals.userId ?? null,
		locals.session?.activeOrganizationId ?? null
	);

	const authAndStart = {
		isAuthenticated: Boolean(locals.userId),
		start: url.searchParams.get('start') === '1'
	};

	switch (result.status) {
		case 'missing':
			throw error(404, 'This shared quiz is no longer available.');
		case 'ready':
			return {
				sharedQuiz: result.quiz,
				sharedQuizError: null,
				...authAndStart
			};
		case 'expired':
			return {
				sharedQuiz: null,
				sharedQuizError: 'This quiz link has expired.',
				...authAndStart
			};
		case 'revoked':
		case 'unavailable':
			return {
				sharedQuiz: null,
				sharedQuizError: 'This shared quiz is no longer available.',
				...authAndStart
			};
		default: {
			const exhaustive: never = result;
			return exhaustive;
		}
	}
};
