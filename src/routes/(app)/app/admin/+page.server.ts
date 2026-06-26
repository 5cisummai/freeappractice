import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/auth/server';
import { isAdminUser } from '$lib/auth/admin.server';

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
	const offset = (page - 1) * PAGE_SIZE;

	try {
		const users = await auth.api.listUsers({
			headers: request.headers,
			query: {
				limit: PAGE_SIZE,
				offset,
				sortBy: 'createdAt',
				sortDirection: 'desc',
				...(search
					? {
							searchValue: search,
							searchField: 'email',
							searchOperator: 'contains'
						}
					: {})
			}
		});

		return {
			users: users.users,
			total: users.total,
			limit: PAGE_SIZE,
			offset,
			search,
			errorMessage: null
		};
	} catch (err) {
		console.error('Failed to load admin users:', err);

		return {
			users: [],
			total: 0,
			limit: PAGE_SIZE,
			offset,
			search,
			errorMessage: 'Unable to load users right now.'
		};
	}
};
