import type { PageServerLoad } from './$types';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { getCurrentStudyPlan } from '$lib/super/study-plan.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [coachAccess, studyPlanAccess] = await Promise.all([
		authorizeFeatureRequest({ locals }, userId, 'coach'),
		authorizeFeatureRequest({ locals }, userId, 'studyPlans')
	]);
	const canView = coachAccess.allowed && studyPlanAccess.allowed;
	const accessMessage = coachAccess.allowed
		? studyPlanAccess.allowed
			? null
			: studyPlanAccess.message
		: coachAccess.message;

	return {
		canView,
		accessMessage,
		plan: canView ? await getCurrentStudyPlan(userId) : null
	};
};
