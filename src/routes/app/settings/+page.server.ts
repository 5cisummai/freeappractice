import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { findUserProfileOrFail } from '$lib/users/profile.server.js';

const validSubjects = new Set(getCourses().map((course) => course.name));

export const load: PageServerLoad = async ({ locals }) => {
	const userProfile = await findUserProfileOrFail(locals.userId!, 'subjects');
	return { selectedSubjects: userProfile.subjects ?? [] };
};

export const actions: Actions = {
	updateSubjects: async ({ request, locals }) => {
		const formData = await request.formData();
		const subjects = formData
			.getAll('subjects')
			.filter(
				(subject): subject is string => typeof subject === 'string' && validSubjects.has(subject)
			);

		if (subjects.length === 0) {
			return fail(400, { subjectError: 'Choose at least one class.' });
		}

		const userProfile = await findUserProfileOrFail(locals.userId!, 'subjects');
		userProfile.subjects = subjects;
		await userProfile.save();

		return { success: true };
	}
};
