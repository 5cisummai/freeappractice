import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getSuperFeatureAccess } from '$lib/super/feature-access.server';
import {
	getCurrentStoredInsightReport,
	getStoredInsightReportPdf
} from '$lib/super/insights.server';
import { ensureInsightPdf } from '$lib/super/insight-lifecycle.server';

export const GET: RequestHandler = withAuthedHandler(
	async (_event, userId) => {
		if (!(await isSuperInsightsEnabled()))
			return json({ error: 'Insights are temporarily unavailable.' }, { status: 503 });
		const access = await getSuperFeatureAccess(userId, 'aiInsights');
		if (!access.allowed) return json({ error: 'Insights are unavailable.' }, { status: 403 });

		let report = await getCurrentStoredInsightReport(userId);
		if (!report) return json({ error: 'No insight report is available yet.' }, { status: 404 });
		if (!report.pdfAvailable) report = await ensureInsightPdf(userId, report);

		const pdfData = await getStoredInsightReportPdf(userId);
		if (!pdfData) return json({ error: 'The insight PDF is not available yet.' }, { status: 503 });

		const date = new Date(report.generatedAt).toISOString().slice(0, 10);
		return new Response(new Uint8Array(pdfData), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename="free-ap-insights-${date}.pdf"`,
				'Cache-Control': 'private, no-store'
			}
		});
	},
	{ logLabel: 'Get insights PDF error', errorMessage: 'Failed to generate insight PDF' }
);
