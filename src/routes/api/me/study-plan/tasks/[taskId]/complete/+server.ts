import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import {
	completeStudyTask,
	getCurrentStudyPlan,
	StudyPlanConflictError,
	StudyPlansLockedError
} from '#lib/agent/plans/store.server.js';
import { toStudyPlanMobileView } from '#lib/agent/plans/mobile.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';

const bodySchema = z
	.object({
		/** Optional optimistic concurrency token from `plan.updatedAt`. */
		expectedUpdatedAt: z.string().datetime().optional()
	})
	.strict();

/**
 * Mark a study-plan task complete.
 *
 * Error codes:
 * - `subscription_required` / `age_required` / `assistant_disabled` / `feature_disabled`
 * - `task_not_found`
 * - `plan_conflict` when the plan changed concurrently
 */
export const POST = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'studyPlans');
		if (!access.allowed) {
			return Response.json({ error: access.message, code: access.code }, { status: access.status });
		}

		const taskId = event.params.taskId?.trim() ?? '';
		if (!taskId || taskId.length > 200) {
			return Response.json(
				{ error: 'Choose a valid study task.', code: 'task_not_found' },
				{ status: 400 }
			);
		}

		let body: unknown = {};
		try {
			const raw = await readJsonBody(event.request, 1024);
			body = raw ?? {};
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Request body is too large' }, { status: 413 });
			}
			return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
		}

		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return Response.json({ error: 'Invalid completion request.' }, { status: 400 });
		}

		try {
			if (parsed.data.expectedUpdatedAt) {
				const current = await getCurrentStudyPlan(userId);
				if (!current) {
					return Response.json(
						{ error: 'That study task could not be found.', code: 'task_not_found' },
						{ status: 404 }
					);
				}
				if (current.updatedAt !== parsed.data.expectedUpdatedAt) {
					return Response.json(
						{ error: 'Your plan changed. Refresh and try again.', code: 'plan_conflict' },
						{ status: 409 }
					);
				}
			}

			const plan = await completeStudyTask(userId, taskId);
			if (!plan) {
				return Response.json(
					{ error: 'That study task could not be found.', code: 'task_not_found' },
					{ status: 404 }
				);
			}

			return Response.json({ plan: toStudyPlanMobileView(plan) });
		} catch (error) {
			if (error instanceof StudyPlanConflictError) {
				return Response.json(
					{ error: 'Your plan changed. Refresh and try again.', code: 'plan_conflict' },
					{ status: 409 }
				);
			}
			if (error instanceof StudyPlansLockedError) {
				return Response.json(
					{ error: error.message, code: 'subscription_required' },
					{ status: 403 }
				);
			}
			throw error;
		}
	},
	{ logLabel: 'Complete study task error', errorMessage: 'Failed to complete study task' }
);
