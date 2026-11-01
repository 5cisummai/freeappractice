import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '#lib/flags.js';
import { getFrqCourseNames } from '#lib/question-bank/frq/profiles.server.js';
import { resolveSharedQuizForUser } from '#lib/shared-practice/shared-sets.server.js';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const sharedSlug = url.searchParams.get('shared')?.trim() ?? '';
	const { activeOrganization } = await parent();
	const [frqEnabled, sharedResult] = await Promise.all([
		isFrqPracticeEnabled(),
		sharedSlug
			? resolveSharedQuizForUser(sharedSlug, locals.userId!, activeOrganization?.id ?? null)
			: Promise.resolve(null)
	]);
	const sharedQuiz = sharedResult?.status === 'ready' ? sharedResult.quiz : null;

	return {
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		sharedQuiz,
		sharedQuizError:
			sharedResult && sharedResult.status !== 'ready'
				? 'This shared quiz is no longer available.'
				: null
	};
};
