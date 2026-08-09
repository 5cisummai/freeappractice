import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ONBOARDING_COOKIE_MAX_AGE,
	ONBOARDING_COOKIE_NAME,
	readOnboardingState,
	serializeCompletedOnboarding
} from '$lib/onboarding.js';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { getUserSubjects, updateUserSubjects } from '$lib/users/model.server.js';

const validSubjects = new Set(getCourses().map((course) => course.name));

export const load: PageServerLoad = async ({ cookies, url, locals }) => {
	const currentState = readOnboardingState(cookies.get(ONBOARDING_COOKIE_NAME));
	const isReset = url.searchParams.get('reset') === '1';
	const selectedSubjects = await getUserSubjects(locals.userId!);

	if (isReset) {
		cookies.set(ONBOARDING_COOKIE_NAME, 'pending', {
			path: '/',
			maxAge: ONBOARDING_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});
		return { selectedSubjects };
	}

	if (currentState.status !== 'pending') {
		throw redirect(303, '/app');
	}

	return { selectedSubjects };
};

export const actions: Actions = {
	default: async ({ cookies, request, locals }) => {
		const formData = await request.formData();
		const subjects = formData
			.getAll('subjects')
			.filter(
				(subject): subject is string => typeof subject === 'string' && validSubjects.has(subject)
			);

		if (subjects.length === 0) {
			return fail(400, { error: 'Choose at least one subject to continue.' });
		}

		await updateUserSubjects(locals.userId!, subjects);

		cookies.set(ONBOARDING_COOKIE_NAME, serializeCompletedOnboarding(), {
			path: '/',
			maxAge: ONBOARDING_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});

		throw redirect(303, '/app');
	}
};
