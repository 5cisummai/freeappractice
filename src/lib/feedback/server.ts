import { randomUUID } from 'node:crypto';
import { limitFeedback } from '#lib/feedback/rate-limit.server.js';
import {
	appFeedbackSchema,
	formatAppFeedbackMessageForStorage
} from '#lib/schemas/app-feedback.js';
import { logger } from '#lib/server/logger.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { appFeedback } from '#lib/server/neon/schema.js';
import { readJsonBody } from '#lib/server/request-body.server.js';

export async function submitAppFeedback(
	request: Request,
	clientIp: string,
	userId?: string
): Promise<Response> {
	try {
		let body: unknown;
		try {
			body = await readJsonBody(request, 384 * 1024);
		} catch {
			return Response.json({ error: 'Invalid request body' }, { status: 400 });
		}

		const result = appFeedbackSchema.safeParse(body);
		if (!result.success) {
			return Response.json(
				{ error: 'Validation failed', details: result.error.flatten() },
				{ status: 400 }
			);
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
			return Response.json(
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
				message: formatAppFeedbackMessageForStorage(parsed)
			});

		logger.info('App feedback stored', {
			feedbackId: id,
			category: parsed.category,
			authenticated: Boolean(userId)
		});

		return Response.json({ ok: true, id }, { status: 201 });
	} catch (err) {
		logger.error('App feedback error', { error: err });
		return Response.json({ error: 'Failed to submit feedback' }, { status: 500 });
	}
}
