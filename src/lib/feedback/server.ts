import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { limitFeedback } from '$lib/feedback/rate-limit.server';
import { appFeedbackSchema } from '$lib/schemas/app-feedback';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { appFeedback } from '$lib/server/neon/schema';
import { readJsonBody } from '$lib/server/request-body.server';

export async function submitAppFeedback(
	request: Request,
	clientIp: string,
	userId?: string
): Promise<Response> {
	try {
		let body: unknown;
		try {
			body = await readJsonBody(request, 32 * 1024);
		} catch {
			return json({ error: 'Invalid request body' }, { status: 400 });
		}

		const result = appFeedbackSchema.safeParse(body);
		if (!result.success) {
			return json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
		}
		const parsed = result.data;
		const now = Date.now();
		const rateLimit = await limitFeedback(clientIp);
		if (rateLimit.degraded) {
			logger.warn('App feedback rate limiting is temporarily degraded');
		}
		if (!rateLimit.allowed) {
			const retryAfterMs = Math.max(0, (rateLimit.retryAt ?? now) - now);
			const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
			return json(
				{
					error: 'Too many feedback submissions. Please wait a few minutes before trying again.',
					retryAfterSeconds
				},
				{
					status: 429,
					headers: {
						'RateLimit-Limit': '3',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
						'Retry-After': String(retryAfterSeconds)
					}
				}
			);
		}

		const id = randomUUID();
		await getNeonDatabase()
			.insert(appFeedback)
			.values({
				id,
				userId: userId ?? null,
				category: parsed.category,
				message: parsed.message
			});

		logger.info('App feedback stored', {
			feedbackId: id,
			category: parsed.category,
			authenticated: Boolean(userId)
		});

		return json({ ok: true, id }, { status: 201 });
	} catch (err) {
		logger.error('App feedback error', { error: err });
		return json({ error: 'Failed to submit feedback' }, { status: 500 });
	}
}
