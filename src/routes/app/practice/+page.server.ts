import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/question-bank/frq/profiles.server';
import { resolveSharedQuiz } from '$lib/shared-practice/shared-sets.server';

export const load: PageServerLoad = async ({ url }) => {
	const sharedSlug = url.searchParams.get('shared')?.trim() ?? '';
	const [frqEnabled, sharedResult] = await Promise.all([
		isFrqPracticeEnabled(),
		sharedSlug ? resolveSharedQuiz(sharedSlug) : Promise.resolve(null)
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
