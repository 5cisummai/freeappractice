import type { PageServerLoad } from './$types';
import { resolveSharedQuiz } from '$lib/shared-practice/shared-sets.server';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const result = await resolveSharedQuiz(params.slug);
	return {
		sharedQuiz: result.status === 'ready' ? result.quiz : null,
		sharedQuizError:
			result.status === 'ready'
				? null
				: result.status === 'expired'
					? 'This quiz link has expired.'
					: 'This shared quiz is no longer available.',
		isAuthenticated: Boolean(locals.userId),
		start: url.searchParams.get('start') === '1'
	};
};
