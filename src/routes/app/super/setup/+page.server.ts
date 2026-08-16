import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	ONBOARDING_INTENT_COOKIE_MAX_AGE,
	ONBOARDING_INTENT_COOKIE_NAME
} from '$lib/onboarding.js';

export const load: PageServerLoad = async ({ cookies, url }) => {
	cookies.set(ONBOARDING_INTENT_COOKIE_NAME, 'super', {
		path: '/',
		maxAge: ONBOARDING_INTENT_COOKIE_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax'
	});

	const query = new URLSearchParams(url.searchParams);
	query.set('super', '1');
	throw redirect(303, `/app/onboarding?${query.toString()}`);
};
