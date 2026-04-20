import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gradeFRQResponse } from '$lib/server/services/question-generate';
import { requireAuth } from '$lib/server/auth';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async (event) => {
	try {
		await requireAuth(event);

		const body = await event.request.json();
		const { className, unit, parts, responses } = body;

		if (typeof className !== 'string' || !className.trim()) {
			return json({ error: 'className is required' }, { status: 400 });
		}
		if (!Array.isArray(parts) || parts.length === 0) {
			return json({ error: 'parts must be a non-empty array' }, { status: 400 });
		}
		if (!responses || typeof responses !== 'object') {
			return json(
				{ error: 'responses must be an object mapping part labels to strings' },
				{ status: 400 }
			);
		}

		const result = await gradeFRQResponse({
			className: className.trim(),
			unit: typeof unit === 'string' ? unit : undefined,
			parts,
			responses
		});

		return json({ grade: result.grade, provider: result.provider, model: result.model });
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Grade FRQ error', { error: err });
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to grade FRQ response', details }, { status: 500 });
	}
};
