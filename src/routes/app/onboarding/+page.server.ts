import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ONBOARDING_COOKIE_NAME,
	ONBOARDING_GOALS,
	ONBOARDING_INTENT_COOKIE_MAX_AGE,
	ONBOARDING_INTENT_COOKIE_NAME,
	ONBOARDING_PENDING_COOKIE_OPTIONS,
	type OnboardingGoal,
	readOnboardingState,
	readOnboardingIntent,
	serializeCompletedOnboarding
} from '$lib/onboarding.js';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { getUserSubjects, updateUserSubjects } from '$lib/users/model.server.js';
import { getSuperBillingView, isSuperStripeConfigured } from '$lib/super/billing.server';
import {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '$lib/super/feature-access.server';
import { isSuperCheckoutEnabled, isSuperFreeBetaEnabled } from '$lib/flags';

const validSubjects = new Set(getCourses().map((course) => course.name));
const validGoals = new Set<string>(ONBOARDING_GOALS);

export const load: PageServerLoad = async ({ cookies, url, locals }) => {
	const currentState = readOnboardingState(cookies.get(ONBOARDING_COOKIE_NAME));
	const isReset = url.searchParams.get('reset') === '1';
	const isSuperQuery = url.searchParams.get('super') === '1';
	const isSuperIntent =
		isSuperQuery || readOnboardingIntent(cookies.get(ONBOARDING_INTENT_COOKIE_NAME)) === 'super';
	const [selectedSubjects, profile] = await Promise.all([
		getUserSubjects(locals.userId!),
		getTutorProfileViewForRequest(locals, locals.userId!)
	]);

	if (isReset) {
		cookies.set(ONBOARDING_COOKIE_NAME, 'pending', ONBOARDING_PENDING_COOKIE_OPTIONS);
		if (isSuperIntent) {
			cookies.set(ONBOARDING_INTENT_COOKIE_NAME, 'super', {
				path: '/',
				maxAge: ONBOARDING_INTENT_COOKIE_MAX_AGE,
				httpOnly: true,
				sameSite: 'lax'
			});
		}
	} else if (isSuperQuery) {
		cookies.set(ONBOARDING_INTENT_COOKIE_NAME, 'super', {
			path: '/',
			maxAge: ONBOARDING_INTENT_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});
	}

	if (currentState.status !== 'pending' && !isSuperQuery && !isReset && profile.ageConfirmedAt) {
		cookies.delete(ONBOARDING_INTENT_COOKIE_NAME, { path: '/' });
		throw redirect(303, '/app');
	}

	if (!isSuperIntent) {
		return {
			selectedSubjects,
			selectedGoals: currentState.goals,
			superIntent: false,
			ageConfirmedAt: profile.ageConfirmedAt,
			userName: locals.user?.name ?? '',
			userEmail: locals.user?.email ?? '',
			superSetup: null
		};
	}

	const [planAccess, billing, checkoutEnabled, freeBetaEnabled, stripeConfigured] =
		await Promise.all([
			getPlanAccessForRequest(locals, locals.userId!),
			getSuperBillingView(locals.userId!),
			isSuperCheckoutEnabled(),
			isSuperFreeBetaEnabled(),
			isSuperStripeConfigured()
		]);

	return {
		selectedSubjects,
		selectedGoals: currentState.goals,
		superIntent: true,
		ageConfirmedAt: profile.ageConfirmedAt,
		userName: locals.user?.name ?? '',
		userEmail: locals.user?.email ?? '',
		superSetup: {
			profile,
			planAccess,
			billing,
			checkoutEnabled: checkoutEnabled && !freeBetaEnabled && stripeConfigured,
			freeBetaEnabled
		}
	};
};

export const actions: Actions = {
	default: async ({ cookies, request, locals }) => {
		const formData = await request.formData();
		const subjects = formData
			.getAll('subjects')
			.filter(
				(subject): subject is string => typeof subject === 'string' && validSubjects.has(subject)
			);
		const goals = formData
			.getAll('goals')
			.filter((goal): goal is OnboardingGoal => typeof goal === 'string' && validGoals.has(goal));

		if (subjects.length === 0) {
			return fail(400, { error: 'Choose at least one subject to continue.' });
		}
		if (goals.length === 0) {
			return fail(400, { error: 'Choose at least one goal to continue.' });
		}

		await updateUserSubjects(locals.userId!, subjects);

		cookies.set(ONBOARDING_COOKIE_NAME, serializeCompletedOnboarding(subjects, goals), {
			...ONBOARDING_PENDING_COOKIE_OPTIONS
		});
		cookies.delete(ONBOARDING_INTENT_COOKIE_NAME, { path: '/' });

		throw redirect(303, '/app');
	}
};
