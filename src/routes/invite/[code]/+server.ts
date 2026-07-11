import { redirect, type RequestHandler } from '@sveltejs/kit';
import { findReferrerByCode, rememberReferralCode } from '$lib/referrals/referrals.server';

export const GET: RequestHandler = async ({ cookies, params }) => {
	const code = params.code?.trim() ?? '';
	const referrerUserId = await findReferrerByCode(code);
	if (referrerUserId) rememberReferralCode(cookies, code);

	redirect(302, '/practice');
};
