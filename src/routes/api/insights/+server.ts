import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	acquireInsightLock,
	claimIdempotencyKey,
	RedisRequiredError,
	releaseLock
} from '$lib/super/ai-controls.server';
import {
	buildAndStoreInsightReport,
	buildInsightReportData,
	getCurrentStoredInsightReport,
	getInsightEligibilityForUser,
	getScoredAttemptsForUser
} from '$lib/super/insights.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import {
	createInsightPdfArtifact,
	getOrBuildWeeklyInsightReport
} from '$lib/super/insight-lifecycle.server';

export const GET: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'aiInsights');
		if (!access.allowed) return json({ error: access.message }, { status: access.status });
		return json({
			insightsEnabled: true,
			eligibility: await getInsightEligibilityForUser(userId),
			report: await getOrBuildWeeklyInsightReport(userId)
		});
	},
	{ logLabel: 'Get insights error', errorMessage: 'Failed to fetch insights' }
);

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'aiInsights');
		if (!access.allowed) return json({ error: access.message }, { status: access.status });
		const operationId = event.request.headers.get('idempotency-key')?.trim();
		if (!operationId || operationId.length > 200) {
			return json({ error: 'An idempotency key is required.' }, { status: 400 });
		}

		try {
			if (!(await claimIdempotencyKey(userId, operationId))) {
				return json({ error: 'This insight refresh was already requested.' }, { status: 409 });
			}
			const lock = await acquireInsightLock(userId);
			if (!lock) return json({ error: 'An insight refresh is already running.' }, { status: 409 });
			try {
				const [eligibility, current] = await Promise.all([
					getInsightEligibilityForUser(userId),
					getCurrentStoredInsightReport(userId)
				]);
				if (!eligibility.eligible) {
					return json({ eligibility, report: null }, { status: 409 });
				}
				if (current && eligibility.totalScoredAttempts - current.evidenceAttemptCount < 10) {
					return json(
						{
							error: 'Add 10 new scored attempts before refreshing insights.',
							eligibility,
							report: current
						},
						{ status: 409 }
					);
				}
				const reportData = buildInsightReportData(await getScoredAttemptsForUser(userId));
				const artifact = await createInsightPdfArtifact(reportData);
				const report = artifact
					? await buildAndStoreInsightReport(userId, {
							manual: true,
							narrative: artifact.narrative,
							pdfData: artifact.pdfData
						})
					: null;
				return json({ eligibility, report });
			} finally {
				await releaseLock(lock);
			}
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json(
					{ error: 'Insights are temporarily unavailable. Please try again.' },
					{ status: 503 }
				);
			}
			throw error;
		}
	},
	{ logLabel: 'Refresh insights error', errorMessage: 'Failed to refresh insights' }
);
