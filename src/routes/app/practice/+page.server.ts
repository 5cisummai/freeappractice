import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';
import { getEntitlements } from '$lib/super/entitlements.server';

export const load: PageServerLoad = async ({ locals }) => {
	const [frqEnabled, entitlements, experiment] = await Promise.all([
		isFrqPracticeEnabled(),
		getEntitlements(locals.userId!),
		getOrAssignMultiAttemptVariant(locals.userId!)
	]);

	return {
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		isPersonalizedTutor: entitlements.personalizedTutor,
		practiceExperiment: {
			assignedVariant: experiment.assigned,
			experimentEnabled: experiment.enabled
		}
	};
};
