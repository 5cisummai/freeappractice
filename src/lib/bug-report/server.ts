import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { limitBugReports } from '$lib/bug-report/rate-limit.server';
import { bugReportSchema } from '$lib/schemas/bug-report';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { bugReports } from '$lib/server/neon/schema';
import { readJsonBody } from '$lib/server/request-body.server';

export async function submitBugReport(
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

		const result = bugReportSchema.safeParse(body);
		if (!result.success) {
			return json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
		}
		const parsed = result.data;
		const now = Date.now();
		const rateLimit = await limitBugReports(clientIp);
		if (rateLimit.degraded) {
			logger.warn('Bug report rate limiting is temporarily degraded');
		}
		if (!rateLimit.allowed) {
			const retryAfterMs = Math.max(0, (rateLimit.retryAt ?? now) - now);
			const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
			return json(
				{
					error: 'Too many bug reports. Please wait a few minutes before submitting another one.',
					retryAfterSeconds
				},
				{
					status: 429,
					headers: {
						'RateLimit-Limit': '1',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
						'Retry-After': String(retryAfterSeconds)
					}
				}
			);
		}

		const id = randomUUID();
		await getNeonDatabase()
			.insert(bugReports)
			.values({
				id,
				userId: userId ?? null,
				title: parsed.title,
				description: parsed.description,
				steps: parsed.steps ?? null,
				expected: parsed.expected ?? null,
				severity: parsed.severity,
				email: parsed.email ?? null,
				metadata: parsed.metadata ?? {}
			});

		logger.info('Bug report stored privately', {
			bugReportId: id,
			severity: parsed.severity,
			authenticated: Boolean(userId)
		});

		return json({ ok: true, id }, { status: 201 });
	} catch (err) {
		logger.error('Bug report error', { error: err });
		return json({ error: 'Failed to submit bug report' }, { status: 500 });
	}
}
