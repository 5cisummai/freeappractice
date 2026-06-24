import { json } from '@sveltejs/kit';
import { getMcqHistoryPage, hydrateMcqHistoryItems } from '$lib/users/history.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50', 10) || 50, 200);
		const page = Math.max(parseInt(event.url.searchParams.get('page') ?? '1', 10) || 1, 1);
		const apClass = event.url.searchParams.get('apClass')?.trim() || undefined;

		const user = await findUserProfileOrFail(userId, 'questionHistory');

		const pageResult = getMcqHistoryPage(user, { page, limit, apClass });
		const items = await hydrateMcqHistoryItems(pageResult.items);

		return json({
			items,
			total: pageResult.total,
			page: pageResult.page,
			limit: pageResult.limit
		});
	},
	{ logLabel: 'History error', errorMessage: 'Failed to get history' }
);
