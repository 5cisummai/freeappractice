import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/question-bank/frq/profiles.server';
import { getPlanAccessForRequest } from '$lib/super/feature-access.server';
import { hasPaidCapability } from '$lib/super/types';
import { resolveSharedQuiz } from '$lib/shared-practice/shared-sets.server';

export const load: PageServerLoad = async ({ locals, url }) => {
	const sharedSlug = url.searchParams.get('shared')?.trim() ?? '';
	const [frqEnabled, planAccess, sharedResult] = await Promise.all([
		isFrqPracticeEnabled(),
		getPlanAccessForRequest(locals, locals.userId!),
		sharedSlug ? resolveSharedQuiz(sharedSlug) : Promise.resolve(null)
	]);
	const sharedQuiz = sharedResult?.status === 'ready' ? sharedResult.quiz : null;

	return {
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		isPersonalizedTutor: hasPaidCapability(planAccess, 'personalizedTutor'),
		sharedQuiz,
		sharedQuizError:
			sharedResult && sharedResult.status !== 'ready'
				? 'This shared quiz is no longer available.'
				: null
	};
};
