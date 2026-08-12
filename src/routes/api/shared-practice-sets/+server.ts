import { json, type RequestHandler } from '@sveltejs/kit';
import { createSharedQuiz } from '$lib/shared-practice/shared-sets.server';
import { getSiteUrl } from '$lib/site-url';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'A valid quiz payload is required.' }, { status: 400 });
	}

	const raw = body as Record<string, unknown>;
	if (!Array.isArray(raw.questionIds) || raw.questionIds.some((id) => typeof id !== 'string')) {
		return json({ error: 'questionIds must be an array of strings.' }, { status: 400 });
	}

	try {
		const sharedQuiz = await createSharedQuiz({
			questionIds: raw.questionIds,
			apClass: typeof raw.apClass === 'string' ? raw.apClass : undefined,
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
		return json(
			{ error: error instanceof Error ? error.message : 'Could not create a share link.' },
			{ status: 400 }
		);
	}
};
