import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCourses } from '$lib/catalog/ap-courses.js';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { updateUserCourses } from '$lib/users/model.server';

const validCourses = new Set(getCourses().map((course) => course.name));
const coursesSchema = z.object({
	courses: z.array(z.string()).min(1).max(validCourses.size)
});

export const POST = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await readJsonBody(event.request, 1024);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Request body is too large' }, { status: 413 });
			}
			return json({ error: 'Course selection must be valid JSON.' }, { status: 400 });
		}

		const parsed = coursesSchema.safeParse(body);
		if (!parsed.success || parsed.data.courses.some((course) => !validCourses.has(course))) {
			return json({ error: 'Choose at least one valid AP course.' }, { status: 400 });
		}

		const courses = [...new Set(parsed.data.courses)];
		await updateUserCourses(userId, courses);
		return json({ courses });
	},
	{ logLabel: 'Save onboarding courses error', errorMessage: 'Failed to save your courses' }
);
