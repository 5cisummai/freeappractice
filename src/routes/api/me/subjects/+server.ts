import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { updateUserSubjects } from '$lib/users/model.server';

const validSubjects = new Set(getCourses().map((course) => course.name));
const subjectsSchema = z.object({
	subjects: z.array(z.string()).min(1).max(validSubjects.size)
});

export const POST = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
			return json({ error: 'Subject selection must be valid JSON.' }, { status: 400 });
		}

		const parsed = subjectsSchema.safeParse(body);
		if (!parsed.success || parsed.data.subjects.some((subject) => !validSubjects.has(subject))) {
			return json({ error: 'Choose at least one valid AP subject.' }, { status: 400 });
		}

		await updateUserSubjects(userId, parsed.data.subjects);
		return json({ subjects: parsed.data.subjects });
	},
	{ logLabel: 'Save onboarding subjects error', errorMessage: 'Failed to save your subjects' }
);
