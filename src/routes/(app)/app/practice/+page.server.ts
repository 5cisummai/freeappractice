import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getFrqCourseNames } from '$lib/frq/profiles.server';

export const load: PageServerLoad = async () => ({
	frqEnabled: await isFrqPracticeEnabled(),
	frqCourses: getFrqCourseNames()
});
