import { json } from '@sveltejs/kit';
import {
	getMcqHistoryPage,
	hydrateMcqHistoryItems,
	getPracticeHistoryPage,
	hydratePracticeHistoryItems,
	parseHistorySort
} from '$lib/users/history.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { isFrqPracticeEnabled } from '$lib/flags';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50', 10) || 50, 200);
		const page = Math.max(parseInt(event.url.searchParams.get('page') ?? '1', 10) || 1, 1);
		const apClass = event.url.searchParams.get('apClass')?.trim() || undefined;
		const sort = parseHistorySort(
			event.url.searchParams.get('sortBy'),
			event.url.searchParams.get('sortDir')
		);

		const user = await findUserProfileOrFail(userId, 'questionHistory');

		const frqEnabled = await isFrqPracticeEnabled();
		if (frqEnabled) {
			const pageResult = await getPracticeHistoryPage(user, userId, { page, limit, apClass, sort });
			const items = await hydratePracticeHistoryItems(pageResult.items);
			return json({
				items,
				total: pageResult.total,
				page: pageResult.page,
				limit: pageResult.limit
			});
		}

		const pageResult = getMcqHistoryPage(user, { page, limit, apClass, sort });
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
