import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { confirmAge } from '$lib/super/profile.server';

const confirmAgeSchema = z.object({ confirmed: z.literal(true) }).strict();

export const POST = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
			return json({ error: 'Age confirmation must be valid JSON' }, { status: 400 });
		}

		const parsed = confirmAgeSchema.safeParse(body);
		if (!parsed.success) {
			return json({ error: 'You must confirm that you are at least 13.' }, { status: 400 });
		}

		const profile = await confirmAge(userId);
		return json({ confirmed: true, ageConfirmedAt: profile.ageConfirmedAt });
	},
	{ logLabel: 'Confirm Super tutor age error', errorMessage: 'Failed to confirm age' }
);
