import { json, type RequestHandler } from '@sveltejs/kit';
import {
	createSharedQuiz,
	SharedQuizValidationError
} from '$lib/shared-practice/shared-sets.server';
import { limitSharedPracticeSetCreation } from '$lib/shared-practice/rate-limit.server';
import { getSiteUrl } from '$lib/site-url';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'A valid quiz payload is required.' }, { status: 400 });
	}

	const raw = body as Record<string, unknown>;
	if (!Array.isArray(raw.questionIds) || raw.questionIds.some((id) => typeof id !== 'string')) {
		return json({ error: 'questionIds must be an array of strings.' }, { status: 400 });
	}
	const rateLimit = await limitSharedPracticeSetCreation(request, locals.userId);
	if (!rateLimit.allowed) {
		const now = Date.now();
		const retryAfterSeconds = Math.ceil(Math.max(0, (rateLimit.retryAt ?? now) - now) / 1000);
		return json(
			{ error: 'Too many share links. Please try again shortly.', retryAfterSeconds },
			{
				status: 429,
				headers: {
					'RateLimit-Limit': String(locals.userId ? 30 : 12),
					'RateLimit-Remaining': '0',
					'RateLimit-Reset': String(Math.ceil((rateLimit.retryAt ?? now) / 1000)),
					'Retry-After': String(retryAfterSeconds)
				}
			}
		);
	}

	try {
		const sharedQuiz = await createSharedQuiz({
			questionIds: raw.questionIds,
			unit: typeof raw.unit === 'string' ? raw.unit : undefined,
			creatorUserId: locals.userId
		});
		return json({
			sharedQuiz: {
				...sharedQuiz,
				url: `${getSiteUrl(url.origin)}/q/${sharedQuiz.slug}`
			}
		});
	} catch (error) {
		if (error instanceof SharedQuizValidationError) {
			return json({ error: error.message }, { status: 400 });
		}
		logger.error('Shared practice set creation failed', { error });
		return json({ error: 'Could not create a share link.' }, { status: 500 });
	}
};
