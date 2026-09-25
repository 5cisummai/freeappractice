import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import {
	completeStudyTask,
	getCurrentStudyPlan,
	StudyPlanConflictError,
	StudyPlansLockedError
} from '$lib/super/study-plan.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const access = await authorizeFeatureRequest({ locals }, userId, 'studyPlans');

	if (!access.allowed) {
		return {
			canView: false,
			accessCode: access.code,
			accessMessage: access.message,
			plan: null
		};
	}

	return {
		canView: true,
		accessCode: null,
		accessMessage: null,
		plan: await getCurrentStudyPlan(userId)
	};
};

export const actions: Actions = {
	complete: async ({ locals, request }) => {
		const userId = locals.userId!;
		const access = await authorizeFeatureRequest({ locals }, userId, 'studyPlans');
		if (!access.allowed) return fail(access.status, { error: access.message });

		const formData = await request.formData();
		const taskId = formData.get('taskId');
		if (typeof taskId !== 'string' || !taskId.trim() || taskId.trim().length > 200) {
			return fail(400, { error: 'Choose a valid study task.' });
		}

		try {
			const plan = await completeStudyTask(userId, taskId.trim());
			if (!plan) return fail(404, { error: 'That study task could not be found.' });
			return { success: true };
		} catch (error) {
			if (error instanceof StudyPlanConflictError) {
				return fail(409, { error: 'Your plan changed. Refresh the page and try again.' });
			}
			if (error instanceof StudyPlansLockedError) {
				return fail(403, { error: 'Study plans are unavailable for this account.' });
			}
			throw error;
		}
	}
};
