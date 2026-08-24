import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { generateInsights } from '$lib/super/insights.server';
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

export const actions = {
	generate: async ({ locals }) => {
		const userId = locals.userId!;
		const [coachAccess, studyPlanAccess] = await Promise.all([
			authorizeFeatureRequest({ locals }, userId, 'coach'),
			authorizeFeatureRequest({ locals }, userId, 'studyPlans')
		]);

		if (!coachAccess.allowed) return fail(coachAccess.status, { error: coachAccess.message });
		if (!studyPlanAccess.allowed)
			return fail(studyPlanAccess.status, { error: studyPlanAccess.message });

		try {
			await generateInsights(userId, new Date(), { force: true });
			return { success: true };
		} catch {
			return fail(500, { error: 'Could not generate your weekly readout. Please try again.' });
		}
	}
};
