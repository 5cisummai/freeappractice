import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';
import { getPlanAccessForRequest } from '$lib/super/feature-access.server';
import { hasPaidCapability } from '$lib/super/types';
import { resolveSharedQuiz } from '$lib/shared-practice/shared-sets.server';

export const load: PageServerLoad = async ({ locals, url }) => {
	const sharedSlug = url.searchParams.get('shared')?.trim() ?? '';
	const [frqEnabled, planAccess, experiment, sharedResult] = await Promise.all([
		isFrqPracticeEnabled(),
		getPlanAccessForRequest(locals, locals.userId!),
		getOrAssignMultiAttemptVariant(locals.userId!),
		sharedSlug ? resolveSharedQuiz(sharedSlug) : Promise.resolve(null)
	]);
	const sharedQuiz = sharedResult?.status === 'ready' ? sharedResult.quiz : null;

	return {
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		isPersonalizedTutor: hasPaidCapability(planAccess, 'personalizedTutor'),
		practiceExperiment: {
			assignedVariant: experiment.assigned,
			experimentEnabled: experiment.enabled
		},
		sharedQuiz,
		sharedQuizError:
			sharedResult && sharedResult.status !== 'ready'
				? 'This shared quiz is no longer available.'
				: null
	};
};
