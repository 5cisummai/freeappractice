import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { FrqAttemptInProgressError, gradeFrqAttempt } from '#lib/grading/frq/attempts.server.js';
import {
	frqGradeRateLimitedResponse,
	limitFrqGrading
} from '#lib/grading/frq/rate-limit.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { FrqGradeRequestSchema } from '#lib/question-bank/frq/types.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

export const config = { maxDuration: 60 };

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const startedAt = Date.now();
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		const parsed = FrqGradeRequestSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return Response.json(
				{ error: parsed.error.issues[0]?.message ?? 'Invalid written response' },
				{ status: 400 }
			);
		}
		const rate = await limitFrqGrading(userId, parsed.data.questionId);
		if (!rate.allowed) return frqGradeRateLimitedResponse(rate.retryAt);
		try {
			const attempt = await gradeFrqAttempt(userId, parsed.data);
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'frq_response_graded',
				properties: {
					course: attempt.course,
					unit: attempt.unit,
					grading_latency_ms: Date.now() - startedAt,
					points_earned: attempt.grade.pointsEarned,
					points_available: attempt.grade.pointsAvailable,
					percentage: attempt.grade.percentage
				}
			});
			return Response.json({ attempt });
		} catch (error) {
			if (error instanceof FrqAttemptInProgressError) {
				return Response.json({ error: error.message }, { status: 409 });
			}
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'frq_grading_failed',
				properties: {
					grading_latency_ms: Date.now() - startedAt,
					error_type: error instanceof Error ? error.name : 'unknown'
				}
			});
			throw error;
		}
	},
	{ logLabel: 'FRQ grading error', errorMessage: 'Failed to grade written response' }
);
