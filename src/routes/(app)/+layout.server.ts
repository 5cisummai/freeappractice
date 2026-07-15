import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { claimReferralFromCookie, getReferralSummary } from '$lib/referrals/referrals.server';
import { getSiteUrl } from '$lib/auth/urls';

export const load: LayoutServerLoad = async ({ cookies, locals, request, url }) => {
	if (!locals.session) {
		throw redirect(302, '/login');
	}

	const userId = locals.userId!;
	await claimReferralFromCookie(cookies, userId, request);
	const referral = await getReferralSummary(userId);

	return {
		user: locals.user!,
		isAdmin: isAdminUser(locals.user),
		referral: {
			studentsHelped: referral.studentsHelped,
			pendingInvites: referral.pendingInvites,
			shareUrl: `${getSiteUrl(url.origin)}/invite/${referral.referralCode}`
		}
	};
};
