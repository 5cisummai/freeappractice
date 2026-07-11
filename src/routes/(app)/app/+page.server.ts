import type { PageServerLoad } from './$types';
import { buildProgressData } from '$lib/users/progress.server';
import { buildStatsData } from '$lib/users/stats.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { timezoneFromCookies } from '$lib/users/timezone';
import { claimReferralFromCookie, getReferralSummary } from '$lib/referrals/referrals.server';
import { getSiteUrl } from '$lib/auth/urls';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const userId = locals.userId!;
	await claimReferralFromCookie(cookies, userId);
	const user = await findUserProfileOrFail(userId, 'questionHistory progress createdAt');
	const referral = await getReferralSummary(userId);

	return {
		stats: buildStatsData(user, timezoneFromCookies(cookies)),
		progress: buildProgressData(user),
		referral: {
			studentsHelped: referral.studentsHelped,
			shareUrl: `${getSiteUrl(url.origin)}/invite/${referral.referralCode}`
		}
	};
};
