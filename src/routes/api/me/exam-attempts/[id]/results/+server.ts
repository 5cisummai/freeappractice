import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { frqGradeRateLimitedResponse } from '#lib/grading/frq/rate-limit.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { getExamResults, gradeExamItem } from '#lib/users/exam-results.server.js';

export const config = { maxDuration: 60 };
export const GET = withAuthedHandler(
	async (event, userId) => {
		if (!event.params.id) return Response.json({ error: 'Not found.' }, { status: 404 });
		const result = await getExamResults(userId, event.params.id);
		if (result.kind === 'success') return Response.json(result.value);
		if (result.kind === 'not_found') return Response.json({ error: 'Not found.' }, { status: 404 });
		return Response.json({ error: 'Exam is not submitted.' }, { status: 409 });
	},
	{ logLabel: 'Exam results error', errorMessage: 'Failed to load exam results' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		const body = await event.request.json().catch(() => null);
		if (!event.params.id || !body || typeof body.itemId !== 'string')
			return Response.json({ error: 'Invalid item.' }, { status: 400 });
		const result = await gradeExamItem(userId, event.params.id, body.itemId);
		if (result.kind === 'success') return Response.json(result.value);
		if (result.kind === 'rate_limited') return frqGradeRateLimitedResponse(result.retryAt);
		if (result.kind === 'not_found') return Response.json({ error: 'Not found.' }, { status: 404 });
		if (result.kind === 'item_not_found')
			return Response.json({ error: 'Item not found.' }, { status: 404 });
		if (result.kind === 'invalid_response')
			return Response.json({ error: 'Invalid saved response.' }, { status: 400 });
		if (result.kind === 'grading_in_progress')
			return Response.json({ error: 'Grading is still in progress.' }, { status: 409 });
		return Response.json({ error: 'Exam is not submitted.' }, { status: 409 });
	},
	{ logLabel: 'Exam grading error', errorMessage: 'Failed to grade response' }
);
