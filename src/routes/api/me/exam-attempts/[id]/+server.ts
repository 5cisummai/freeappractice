import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getExamAttempt, mutateExamAttempt } from '#lib/users/exam-attempts.server.js';

const notFound = () => Response.json({ error: 'Exam attempt not found.' }, { status: 404 });
const mutation = z
	.object({
		revision: z.number().int().nonnegative(),
		action: z.enum(['start', 'save', 'finish']),
		responses: z.record(z.string().min(1).max(128), z.string().max(50000)).default({})
	})
	.strict();

export const GET = withAuthedHandler(
	async (event, userId) => {
		if (!event.params.id) return notFound();
		const result = await getExamAttempt(userId, event.params.id);
		if (result.kind === 'success') return Response.json(result.value);
		if (result.kind === 'not_found') return notFound();
		return notFound();
	},
	{ logLabel: 'Exam lookup error', errorMessage: 'Failed to load exam' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		if (!event.params.id) return notFound();
		const input = mutation.safeParse(await event.request.json().catch(() => null));
		if (!input.success) return Response.json({ error: 'Invalid exam save.' }, { status: 400 });
		const result = await mutateExamAttempt(userId, event.params.id, input.data);
		if (result.kind === 'success') return Response.json(result.value);
		if (result.kind === 'not_found') return notFound();
		if (result.kind === 'invalid_item')
			return Response.json(
				{ error: 'Response contains an item outside the active section.' },
				{ status: 400 }
			);
		if (result.kind === 'responses_too_large')
			return Response.json({ error: 'Responses are too large.' }, { status: 400 });
		return Response.json(
			{ error: 'Exam changed or the section is closed. Reload and try again.' },
			{ status: 409 }
		);
	},
	{ logLabel: 'Exam save error', errorMessage: 'Failed to save exam' }
);
