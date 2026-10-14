import type { RequestHandler } from './$types';
import { requireQuestionQualityAdmin } from '#lib/question-bank/quality/admin-auth.server.js';
import { getQualityDashboardSnapshot } from '#lib/question-bank/quality/dashboard.server.js';
import {
	createReviewJob,
	previewReviewJob,
	reconcileQuestionInventory,
	recordHumanDecision,
	refreshReviewJob,
	setReviewJobState
} from '#lib/question-bank/quality/service.server.js';
import { questionQualityRequestSchema } from '#lib/question-bank/quality/payloads.js';

export const GET: RequestHandler = async (event) => {
	requireQuestionQualityAdmin(event);
	return Response.json(await getQualityDashboardSnapshot());
};

export const POST: RequestHandler = async (event) => {
	const actorId = requireQuestionQualityAdmin(event);
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		return Response.json({ message: 'Request body must be valid JSON' }, { status: 400 });
	}
	const parsed = questionQualityRequestSchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ message: 'Invalid question-quality request', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const body = parsed.data;

	switch (body.action) {
		case 'preview':
			return Response.json(await previewReviewJob(body.filters ?? {}, actorId));
		case 'create':
			return Response.json(await createReviewJob(body.previewId, actorId), { status: 202 });
		case 'refresh':
			return Response.json(await refreshReviewJob(body.jobId));
		case 'pause':
		case 'resume':
		case 'cancel':
			return Response.json(await setReviewJobState(body.jobId, body.action));
		case 'humanDecision':
			await recordHumanDecision({
				questionId: body.questionId,
				verdict: body.verdict,
				notes: body.notes?.trim() ?? '',
				reviewerId: actorId
			});
			return Response.json({ ok: true });
		case 'reconcile':
			return Response.json(
				await reconcileQuestionInventory({ hydrateMetadata: body.hydrateMetadata ?? false })
			);
		default:
			return Response.json({ message: 'Unknown action' }, { status: 400 });
	}
};
