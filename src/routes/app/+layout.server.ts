import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { loadAppOrganizations } from '$lib/auth/organizations.server';
import { isSuperCoachEnabled, isSuperFreeBetaEnabled } from '$lib/flags';
import { claimReferralFromCookie } from '$lib/referrals/referrals.server';
import {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '$lib/super/feature-access.server';
import { hasPaidCapability } from '$lib/super/types';
import { hasClaimedSuperFreeBeta } from '$lib/super/profile.server';
import {
	ONBOARDING_COOKIE_MAX_AGE,
	ONBOARDING_COOKIE_NAME,
	readOnboardingState
} from '$lib/onboarding.js';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';

export const load: LayoutServerLoad = async ({ cookies, locals, request, url }) => {
	if (!locals.session) {
		throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	if (url.searchParams.get('signup') === 'google') {
		cookies.set(ONBOARDING_COOKIE_NAME, 'pending', {
			path: '/',
			maxAge: ONBOARDING_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});
		if (!url.pathname.startsWith('/app/invite/')) {
			throw redirect(303, '/app/onboarding');
		}
	}

	const onboardingState = readOnboardingState(cookies.get(ONBOARDING_COOKIE_NAME));
	const isInvite = url.pathname.startsWith('/app/invite/');
	if (onboardingState.status === 'pending' && !url.pathname.endsWith('/onboarding') && !isInvite) {
		throw redirect(303, '/app/onboarding');
	}

	const userId = locals.userId!;
	await claimReferralFromCookie(cookies, userId, request);
	const assistantFeaturesEnabled = await getAssistantFeaturesEnabledForRequest(locals, userId);
	const coachSidebarEnabled = assistantFeaturesEnabled
		? await (async () => {
				const [planAccess, profile, coachEnabled] = await Promise.all([
					getPlanAccessForRequest(locals, userId),
					getTutorProfileViewForRequest(locals, userId),
					isSuperCoachEnabled()
				]);
				return (
					coachEnabled && hasPaidCapability(planAccess, 'coach') && Boolean(profile.ageConfirmedAt)
				);
			})()
		: false;
	const organizations = await loadAppOrganizations(
		userId,
		locals.session.activeOrganizationId,
		request.headers
	);
	if (organizations.activeOrganization) {
		locals.activeOrganizationType = organizations.activeOrganization.orgType;
	}

	const freeBetaEnabled = await isSuperFreeBetaEnabled();
	let showFreeBetaClaimDialog = false;
	const isConfirmingAge = url.pathname === '/app/confirm-age';
	if (freeBetaEnabled && !url.pathname.endsWith('/onboarding') && !isConfirmingAge) {
		const [claimed, planAccess] = await Promise.all([
			hasClaimedSuperFreeBeta(userId),
			getPlanAccessForRequest(locals, userId)
		]);
		showFreeBetaClaimDialog = !claimed && planAccess.plan !== 'super';
	}

	return {
		user: locals.user!,
		isAdmin: isAdminUser(locals.user),
		freeBetaEnabled,
		assistantFeaturesEnabled,
		coachSidebarEnabled,
		showFreeBetaClaimDialog,
		organizations: organizations.organizations,
		activeOrganization: organizations.activeOrganization,
		ownedGroupCount: organizations.ownedGroupCount
	};
};
