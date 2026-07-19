import { redirect, type RequestHandler } from '@sveltejs/kit';
import {
	captureInviteLanded,
	findReferrerByCode,
	rememberReferralCode
} from '$lib/referrals/referrals.server';

export const GET: RequestHandler = async ({ cookies, params }) => {
	const code = params.code?.trim() ?? '';
	const referrerUserId = await findReferrerByCode(code);
	const codeValid = Boolean(referrerUserId);

	if (referrerUserId) rememberReferralCode(cookies, code);
	captureInviteLanded(codeValid);

	throw redirect(302, codeValid ? '/subjects?invited=1' : '/subjects');
};
