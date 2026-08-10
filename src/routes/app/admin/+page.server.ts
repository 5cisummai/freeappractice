import type { PageServerLoad } from './$types';
import { getAdminDashboardData } from '$lib/admin/dashboard.server';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ request, url }) => {
	const search = url.searchParams.get('search')?.trim() ?? '';
	const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

	return getAdminDashboardData({
		headers: request.headers,
		search,
		page,
		limit: PAGE_SIZE,
		tab: url.searchParams.get('tab')
	});
};
