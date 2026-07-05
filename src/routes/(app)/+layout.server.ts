import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.session) {
		throw redirect(302, '/login');
	}

	return {
		user: locals.user!,
		isAdmin: isAdminUser(locals.user)
	};
};
