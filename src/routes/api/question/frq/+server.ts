import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedFRQQuestion } from '$lib/server/services/frq-cache';
import { requireAuth } from '$lib/server/auth';
import { dev } from '$app/environment';

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const body = await event.request.json();
		const { className, unit } = body;

		if (typeof className !== 'string' || !className.trim()) {
			return json(
				{ error: 'className is required and must be a non-empty string' },
				{ status: 400 }
			);
		}
		if (unit !== undefined && typeof unit !== 'string') {
			return json({ error: 'unit must be a string if provided' }, { status: 400 });
		}

		const result = await getCachedFRQQuestion(className.trim(), unit ?? '', userId);

		return json({
			question: result.question,
			provider: result.provider,
			model: result.model,
			cached: result.cached ?? false,
			questionId: result.questionId
		});
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Generate FRQ question error:', err);
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to generate FRQ question', details }, { status: 500 });
	}
};
