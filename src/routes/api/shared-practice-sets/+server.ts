import { type RequestHandler } from '@sveltejs/kit';
import { assertCanAttachSharedSetToOrganization } from '#lib/auth/organization-queries.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';
import {
	createSharedQuiz,
	SharedQuizValidationError
} from '#lib/shared-practice/shared-sets.server.js';
import { limitSharedPracticeSetCreation } from '#lib/shared-practice/rate-limit.server.js';
import { getSiteUrl } from '#lib/site-url.js';
import { logger } from '#lib/server/logger.js';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return Response.json({ error: 'A valid quiz payload is required.' }, { status: 400 });
	}

	const raw = body as Record<string, unknown>;
	if (!Array.isArray(raw.questionIds) || raw.questionIds.some((id) => typeof id !== 'string')) {
		return Response.json({ error: 'questionIds must be an array of strings.' }, { status: 400 });
	}
	const rateLimit = await limitSharedPracticeSetCreation(request, locals.userId);
	if (!rateLimit.allowed) {
		const now = Date.now();
		const retryAfterSeconds = Math.ceil(Math.max(0, (rateLimit.retryAt ?? now) - now) / 1000);
		return Response.json(
			{ error: 'Too many share links. Please try again shortly.', retryAfterSeconds },
			{
				status: 429,
				headers: {
					'RateLimit-Limit': String(locals.userId ? 30 : 12),
					'RateLimit-Remaining': '0',
					'RateLimit-Reset': String(retryAfterSeconds),
					'Retry-After': String(retryAfterSeconds)
				}
			}
		);
	}

	try {
		const organizationId =
			typeof raw.organizationId === 'string' ? raw.organizationId.trim() : undefined;
		if (organizationId && !locals.userId) {
			return Response.json({ error: 'Sign in to share with an organization.' }, { status: 401 });
		}
		if (organizationId && locals.userId) {
			await assertCanAttachSharedSetToOrganization(locals.userId, organizationId);
		}

		const sharedQuiz = await createSharedQuiz({
			questionIds: raw.questionIds,
			unit: typeof raw.unit === 'string' ? raw.unit : undefined,
			creatorUserId: locals.userId,
			organizationId: organizationId || undefined
		});
		return Response.json({
			sharedQuiz: {
				...sharedQuiz,
				url: `${getSiteUrl(url.origin)}/q/${sharedQuiz.slug}`
			}
		});
	} catch (error) {
		if (error instanceof SharedQuizValidationError) {
			return Response.json({ error: error.message }, { status: 400 });
		}
		if (error instanceof OrganizationPermissionError) {
			return Response.json({ error: error.message }, { status: 403 });
		}
		logger.error('Shared practice set creation failed', { error });
		return Response.json({ error: 'Could not create a share link.' }, { status: 500 });
	}
};
