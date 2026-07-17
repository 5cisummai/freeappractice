import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { FrqAttemptInProgressError, gradeFrqAttempt } from '$lib/frq/attempts.server';
import { FrqGradeRequestSchema } from '$lib/frq/types';
import { isFrqPracticeEnabled } from '$lib/flags';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const config = { maxDuration: 60 };

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const startedAt = Date.now();
		if (!(await isFrqPracticeEnabled())) {
			return json({ error: 'Written-response practice is not enabled' }, { status: 404 });
		}
		const parsed = FrqGradeRequestSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return json(
				{ error: parsed.error.issues[0]?.message ?? 'Invalid written response' },
				{ status: 400 }
			);
		}
		try {
			const attempt = await gradeFrqAttempt(userId, parsed.data);
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'frq_response_graded',
				properties: {
					ap_class: attempt.apClass,
					unit: attempt.unit,
					grading_latency_ms: Date.now() - startedAt,
					points_earned: attempt.grade.pointsEarned,
					points_available: attempt.grade.pointsAvailable,
					percentage: attempt.grade.percentage
				}
			});
			return json({ attempt });
		} catch (error) {
			if (error instanceof FrqAttemptInProgressError) {
				return json({ error: error.message }, { status: 409 });
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
