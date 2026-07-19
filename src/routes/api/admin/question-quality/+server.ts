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
import type { QualityVerdict, ReviewFilters } from '$lib/question-quality/types';

export const GET: RequestHandler = async (event) => {
	requireQuestionQualityAdmin(event);
	return json(await getQualityDashboardSnapshot());
};

export const POST: RequestHandler = async (event) => {
	const actorId = requireQuestionQualityAdmin(event);
	const body = (await event.request.json()) as {
		action?: string;
		filters?: ReviewFilters;
		previewId?: string;
		jobId?: string;
		questionId?: string;
		verdict?: QualityVerdict;
		notes?: string;
		hydrateMetadata?: boolean;
	};

	switch (body.action) {
		case 'preview':
			return json(await previewReviewJob(body.filters ?? {}, actorId));
		case 'create':
			if (!body.previewId) return json({ message: 'previewId is required' }, { status: 400 });
			return json(await createReviewJob(body.previewId, actorId), { status: 202 });
		case 'refresh':
			if (!body.jobId) return json({ message: 'jobId is required' }, { status: 400 });
			return json(await refreshReviewJob(body.jobId));
		case 'pause':
		case 'resume':
		case 'cancel':
			if (!body.jobId) return json({ message: 'jobId is required' }, { status: 400 });
			return json(await setReviewJobState(body.jobId, body.action));
		case 'humanDecision':
			if (!body.questionId || !body.verdict) {
				return json({ message: 'questionId and verdict are required' }, { status: 400 });
			}
			await recordHumanDecision({
				questionId: body.questionId,
				verdict: body.verdict,
				notes: body.notes?.trim() ?? '',
				reviewerId: actorId
			});
			return json({ ok: true });
		case 'reconcile':
			return json(await reconcileQuestionInventory({ hydrateMetadata: body.hydrateMetadata }));
		default:
			return json({ message: 'Unknown action' }, { status: 400 });
	}
};
