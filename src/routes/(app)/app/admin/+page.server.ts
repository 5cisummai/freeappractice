import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { getAdminDashboardData } from '$lib/admin/dashboard.server';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals, request, url }) => {
	if (!locals.session || !locals.user) {
		throw redirect(302, '/login');
	}

	if (!isAdminUser(locals.user)) {
		throw error(403, 'Admin access required');
	}

	const search = url.searchParams.get('search')?.trim() ?? '';
	const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);

	return getAdminDashboardData({
		headers: request.headers,
		search,
		page,
		limit: PAGE_SIZE,
		tab: url.searchParams.get('tab')
	});
};
