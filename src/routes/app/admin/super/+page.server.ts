import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { getSuperAdminOverview } from '$lib/super/admin.server';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session || !locals.user) throw redirect(302, '/login');
	if (!isAdminUser(locals.user)) throw error(403, 'Admin access required');
	return getSuperAdminOverview();
};
