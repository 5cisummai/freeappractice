import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { isFrqPracticeEnabled } from '#lib/flags.js';
import { historyFromParam, MAX_HISTORY_DAYS } from '#lib/components/progress/progress-metrics.js';
import { getProgressHistory } from '#lib/users/history.server.js';
import { resolveApiPracticeContext } from '#lib/users/practice-context.server.js';
import { timezoneFromRequest } from '#lib/users/timezone.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveApiPracticeContext(event, userId);
		const timeZone = timezoneFromRequest(event.request, event.cookies);
		const historyItems = await getProgressHistory(
			userId,
			{
				from: historyFromParam(MAX_HISTORY_DAYS, timeZone),
				includeFrq: await isFrqPracticeEnabled()
			},
			context
		);
		return Response.json({ historyItems });
	},
	{ logLabel: 'Progress history error', errorMessage: 'Failed to load progress history' }
);
