import type { PageServerLoad } from './$types';
import { resolveSharedQuizForUser } from '#lib/shared-practice/shared-sets.server.js';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const result = await resolveSharedQuizForUser(
		params.slug,
		locals.userId ?? null,
		locals.session?.activeOrganizationId ?? null
	);
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
