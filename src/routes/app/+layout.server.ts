import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { APP_LAYOUT_DEPENDENCY } from '$lib/layout-dependencies';
import { isAdminUser } from '$lib/auth/admin.server';
import { activeOrgUsesUserSuper, loadAppOrganizations } from '$lib/auth/organizations.server';
import { isSuperCoachEnabled, isSuperFreeBetaEnabled } from '$lib/flags';
import { claimReferralFromCookie } from '$lib/referrals/referrals.server';
import {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '$lib/super/feature-access.server';
import { hasPaidCapability } from '$lib/super/types';
import { hasClaimedSuperFreeBeta } from '$lib/super/profile.server';
import {
	ONBOARDING_COOKIE_NAME,
	ONBOARDING_PENDING_COOKIE_OPTIONS,
	readOnboardingState
} from '$lib/onboarding.js';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';

export const load: LayoutServerLoad = async ({ cookies, depends, locals, request, url }) => {
	depends(APP_LAYOUT_DEPENDENCY);

	if (!locals.session) {
		throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	if (url.searchParams.get('signup') === 'google') {
		// Idempotent: user.create.after already set this; keep for older sessions / race safety.
		cookies.set(ONBOARDING_COOKIE_NAME, 'pending', ONBOARDING_PENDING_COOKIE_OPTIONS);
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
	const organizations = await loadAppOrganizations(
		userId,
		locals.session.activeOrganizationId,
		request.headers
	);
	if (organizations.activeOrganization) {
		locals.activeOrganizationType = organizations.activeOrganization.orgType;
	}
	const coachSidebarEnabled = assistantFeaturesEnabled
		? await (async () => {
				const [planAccess, profile, coachEnabled] = await Promise.all([
					getPlanAccessForRequest(locals, userId),
					getTutorProfileViewForRequest(locals, userId),
					isSuperCoachEnabled()
				]);
				return (
					coachEnabled &&
					(await activeOrgUsesUserSuper(locals)) &&
					hasPaidCapability(planAccess, 'coach') &&
					Boolean(profile.ageConfirmedAt)
				);
			})()
		: false;

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
