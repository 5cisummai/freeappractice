import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.session || !locals.user) {
		throw redirect(302, '/login');
	}

	if (!isAdminUser(locals.user)) {
		throw error(403, 'Admin access required');
	}
};
