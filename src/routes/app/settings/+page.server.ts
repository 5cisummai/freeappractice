import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { selectValidCourses } from '#lib/users/course-selection.js';
import {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '#lib/agent/access.server.js';
import { updateUserCourses } from '#lib/users/model.server.js';
import { getUserSettings } from '#lib/users/settings.server.js';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const userId = locals.userId!;
	const [planAccess, profile] = await Promise.all([
		getPlanAccessForRequest(locals, userId),
		getTutorProfileViewForRequest(locals, userId)
	]);
	return {
		...(await getUserSettings(userId, planAccess, profile)),
		defaultPracticeMode: cookies.get('practice_default_mode') === 'frq' ? 'frq' : 'mcq',
		showQuizTimer: cookies.get('practice_hide_quiz_timer') !== '1',
		defaultQuizCount: Math.max(1, Math.min(50, Number(cookies.get('practice_quiz_count')) || 10))
	};
};

export const actions: Actions = {
	updateCourses: async ({ request, locals }) => {
		const formData = await request.formData();
		const courses = selectValidCourses(formData.getAll('courses'));

		if (!courses) {
			return fail(400, { courseError: 'Choose at least one class.' });
		}

		await updateUserCourses(locals.userId!, courses);

		return { success: true };
	}
};
