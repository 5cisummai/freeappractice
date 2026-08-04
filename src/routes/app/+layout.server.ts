import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { claimReferralFromCookie } from '$lib/referrals/referrals.server';

export const load: LayoutServerLoad = async ({ cookies, locals, request }) => {
	if (!locals.session) {
		throw redirect(302, '/login');
	}

	const userId = locals.userId!;
	await claimReferralFromCookie(cookies, userId, request);

	return {
		user: locals.user!,
		isAdmin: isAdminUser(locals.user)
	};
};
