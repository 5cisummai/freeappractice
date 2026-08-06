import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperInsightsEnabled } from '$lib/flags';
import { claimIdempotencyKey, RedisRequiredError } from '$lib/super/ai-controls.server';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';
import { writeStudyPlanAudit } from '$lib/super/study-plan-audit.server';
import {
	completeStudyTask,
	generateStudyPlan,
	getCurrentStudyPlan,
	rescheduleStudyTask
} from '$lib/super/study-plan.server';

const requestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('generate'),
			behavior: z.enum(['replace', 'merge']).default('replace')
		})
		.strict(),
	z.object({ action: z.literal('complete'), taskId: z.string().trim().min(1).max(200) }).strict(),
	z
		.object({
			action: z.literal('reschedule'),
			taskId: z.string().trim().min(1).max(200),
			date: z.string().datetime()
		})
		.strict()
]);

export const GET: RequestHandler = withAuthedHandler(
	async (_event, userId) => {
		if (!(await isSuperInsightsEnabled()))
			return json({ error: 'Study plans are temporarily unavailable.' }, { status: 503 });
		const access = await getSuperFeatureAccess(userId, 'studyPlans');
		if (!access.allowed)
			return json(
				{ error: superFeatureAccessMessage(access, 'Super study plans') },
				{ status: 403 }
			);
		return json({ plan: await getCurrentStudyPlan(userId) });
	},
	{ logLabel: 'Get study plan error', errorMessage: 'Failed to fetch study plan' }
);

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperInsightsEnabled()))
			return json({ error: 'Study plans are temporarily unavailable.' }, { status: 503 });
		const access = await getSuperFeatureAccess(userId, 'studyPlans');
		if (!access.allowed)
			return json(
				{ error: superFeatureAccessMessage(access, 'Super study plans') },
				{ status: 403 }
			);
		const parsed = requestSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid study plan request' }, { status: 400 });
		const operationId = event.request.headers.get('idempotency-key')?.trim();
		if (!operationId || operationId.length > 200) {
			return json({ error: 'An idempotency key is required.' }, { status: 400 });
		}

		try {
			if (!(await claimIdempotencyKey(userId, operationId))) {
				return json({ error: 'This study-plan change was already requested.' }, { status: 409 });
			}
			const before = await getCurrentStudyPlan(userId);
			if (parsed.data.action === 'generate') {
				const plan = await generateStudyPlan(userId, { behavior: parsed.data.behavior });
				if (!plan)
					return json(
						{ error: 'Generate insights before creating a study plan.' },
						{ status: 409 }
					);
				const audit = await writeStudyPlanAudit({
					userId,
					action: 'generate',
					before,
					after: plan
				});
				return json({ plan, audit });
			}
			const plan =
				parsed.data.action === 'complete'
					? await completeStudyTask(userId, parsed.data.taskId)
					: await rescheduleStudyTask(userId, parsed.data.taskId, parsed.data.date);
			if (!plan) return json({ error: 'Study task not found' }, { status: 404 });
			const audit = await writeStudyPlanAudit({
				userId,
				action: parsed.data.action,
				before,
				after: plan
			});
			return json({ plan, audit });
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json(
					{ error: 'Study-plan changes are temporarily unavailable. Please try again.' },
					{ status: 503 }
				);
			}
			throw error;
		}
	},
	{ logLabel: 'Update study plan error', errorMessage: 'Failed to update study plan' }
);
