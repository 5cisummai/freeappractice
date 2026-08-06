import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getEntitlements } from '$lib/super/entitlements.server';
import { InsightReport } from '$lib/super/models.server';

const feedbackSchema = z
	.object({
		reportId: z.string().regex(/^[a-f\d]{24}$/i),
		feedback: z.enum(['helpful', 'not_helpful']),
		reason: z.string().trim().max(120).optional()
	})
	.strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperInsightsEnabled())) {
			return json({ error: 'Insights are temporarily unavailable.' }, { status: 503 });
		}
		if (!(await getEntitlements(userId)).aiInsights) {
			return json({ error: 'Super subscription required' }, { status: 403 });
		}
		const parsed = feedbackSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid insight feedback' }, { status: 400 });
		const result = await InsightReport.updateOne(
			{ _id: parsed.data.reportId, userId },
			{ $set: { feedback: parsed.data.feedback, feedbackReason: parsed.data.reason ?? '' } }
		).exec();
		return result.matchedCount
			? json({ saved: true })
			: json({ error: 'Insight report not found' }, { status: 404 });
	},
	{ logLabel: 'Insight feedback error', errorMessage: 'Failed to save insight feedback' }
);
