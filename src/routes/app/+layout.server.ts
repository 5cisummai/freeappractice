import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { claimReferralFromCookie } from '$lib/referrals/referrals.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { hasClaimedSuperFreeBeta } from '$lib/super/profile.server';
import {
	ONBOARDING_COOKIE_MAX_AGE,
	ONBOARDING_COOKIE_NAME,
	readOnboardingState
} from '$lib/onboarding.js';

export const load: LayoutServerLoad = async ({ cookies, locals, request, url }) => {
	if (!locals.session) {
		throw redirect(302, '/login');
	}

	if (url.searchParams.get('signup') === 'google') {
		cookies.set(ONBOARDING_COOKIE_NAME, 'pending', {
			path: '/',
			maxAge: ONBOARDING_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});
		throw redirect(303, '/app/onboarding');
	}

	const onboardingState = readOnboardingState(cookies.get(ONBOARDING_COOKIE_NAME));
	if (onboardingState.status === 'pending' && !url.pathname.endsWith('/onboarding')) {
		throw redirect(303, '/app/onboarding');
	}

	const userId = locals.userId!;
	await claimReferralFromCookie(cookies, userId, request);

	const freeBetaEnabled = await isSuperFreeBetaEnabled();
	let showFreeBetaClaimDialog = false;
	const isConfirmingAge = url.pathname === '/app/confirm-age';
	if (freeBetaEnabled && !url.pathname.endsWith('/onboarding') && !isConfirmingAge) {
		const [claimed, entitlements] = await Promise.all([
			hasClaimedSuperFreeBeta(userId),
			getEntitlements(userId)
		]);
		showFreeBetaClaimDialog = !claimed && entitlements.plan !== 'super';
	}

	return {
		user: locals.user!,
		isAdmin: isAdminUser(locals.user),
		freeBetaEnabled,
		showFreeBetaClaimDialog
	};
};
