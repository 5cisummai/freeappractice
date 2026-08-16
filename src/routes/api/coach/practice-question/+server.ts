import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { readJsonBody } from '$lib/server/request-body.server';
import { giveCoachPracticeQuestion } from '$lib/super/coach-questions.server';

const practiceQuestionRequestSchema = z
	.object({
		apClass: z.string().trim().min(1).max(100),
		unit: z.string().trim().min(1).max(200).optional(),
		mode: z.enum(['mcq', 'frq']).default('mcq')
	})
	.strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) {
			return json({ error: access.message }, { status: access.status });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request);
		} catch {
			return json({ error: 'Invalid practice question request' }, { status: 400 });
		}

		const parsed = practiceQuestionRequestSchema.safeParse(body);
		if (!parsed.success) {
			return json({ error: 'Invalid practice question request' }, { status: 400 });
		}

		const result = await giveCoachPracticeQuestion(userId, parsed.data);
		if ('error' in result) {
			return json(result, { status: result.retryAfterSeconds ? 503 : 400 });
		}

		return json({ question: result });
	},
	{ logLabel: 'Coach practice question error', errorMessage: 'Failed to load practice question' }
);
