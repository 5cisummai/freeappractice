import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyQuestionsAdminSecret } from '$lib/server/admin-question-batch';
import { runBatchQuestionAnalysis } from '$lib/server/services/question-batch-analysis';
import { env } from '$env/dynamic/private';

/**
 * POST /api/admin/questions/batch-analyze
 * Auth: header `X-Questions-Admin-Secret` must match `QUESTIONS_S3_ADMIN_SECRET`.
 * Optional JSON body: `{ "maxSamples": number }` (default 50) — limit stored per-question rows in the response.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!env.QUESTIONS_S3_ADMIN_SECRET) {
		return json({ error: 'Question batch admin is not configured' }, { status: 503 });
	}

	if (!verifyQuestionsAdminSecret(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let maxSamples = 50;
	try {
		const ct = request.headers.get('content-type') ?? '';
		if (ct.includes('application/json')) {
			const body = await request.json().catch(() => ({}));
			if (body && typeof body === 'object' && 'maxSamples' in body) {
				const n = Number((body as { maxSamples?: unknown }).maxSamples);
				if (Number.isFinite(n) && n >= 0 && n <= 500) maxSamples = Math.floor(n);
			}
		}
	} catch {
		// ignore body parse errors; use defaults
	}

	try {
		const result = await runBatchQuestionAnalysis({ maxSamples });
		return json({ ok: true, result });
	} catch (err) {
		console.error('batch-analyze error:', err);
		return json({ error: 'Batch analysis failed' }, { status: 500 });
	}
};
