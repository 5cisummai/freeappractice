import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireQuestionQualityAdmin } from '$lib/question-quality/admin-auth.server';
import { getQualityDashboardSnapshot } from '$lib/question-quality/dashboard.server';
import {
	createReviewJob,
	previewReviewJob,
	reconcileQuestionInventory,
	recordHumanDecision,
	refreshReviewJob,
	setReviewJobState
} from '$lib/question-quality/service.server';
import { questionQualityRequestSchema } from '$lib/question-quality/payloads';

export const GET: RequestHandler = async (event) => {
	requireQuestionQualityAdmin(event);
	return json(await getQualityDashboardSnapshot());
};

export const POST: RequestHandler = async (event) => {
	const actorId = requireQuestionQualityAdmin(event);
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		return json({ message: 'Request body must be valid JSON' }, { status: 400 });
	}
	const parsed = questionQualityRequestSchema.safeParse(raw);
	if (!parsed.success) {
		return json(
			{ message: 'Invalid question-quality request', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const body = parsed.data;

	switch (body.action) {
		case 'preview':
			return json(await previewReviewJob(body.filters ?? {}, actorId));
		case 'create':
			return json(await createReviewJob(body.previewId, actorId), { status: 202 });
		case 'refresh':
			return json(await refreshReviewJob(body.jobId));
		case 'pause':
		case 'resume':
		case 'cancel':
			return json(await setReviewJobState(body.jobId, body.action));
		case 'humanDecision':
			await recordHumanDecision({
				questionId: body.questionId,
				verdict: body.verdict,
				notes: body.notes?.trim() ?? '',
				reviewerId: actorId
			});
			return json({ ok: true });
		case 'reconcile':
			return json(
				await reconcileQuestionInventory({ hydrateMetadata: body.hydrateMetadata ?? false })
			);
		default:
			return json({ message: 'Unknown action' }, { status: 400 });
	}
};
