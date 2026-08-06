import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { getEntitlements } from '$lib/super/entitlements.server';

export const load: PageServerLoad = async ({ locals }) => {
	const [frqEnabled, entitlements] = await Promise.all([
		isFrqPracticeEnabled(),
		getEntitlements(locals.userId!)
	]);

	return {
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		isPersonalizedTutor: entitlements.personalizedTutor
	};
};
