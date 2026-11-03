import { selectValidCourses } from '#lib/users/course-selection.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { getUserCourses, updateUserCourses } from '#lib/users/model.server.js';
import { buildSelectedCourseEntries } from '#lib/users/home-dashboard.server.js';

/** Selected courses in saved order, including courses with no practice activity. */
export const GET = withAuthedHandler(
	async (_event, userId) => {
		const courses = await getUserCourses(userId);
		return Response.json({
			courses: buildSelectedCourseEntries(courses)
		});
	},
	{ logLabel: 'Get selected courses error', errorMessage: 'Failed to load your courses' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await readJsonBody(event.request, 1024);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Request body is too large' }, { status: 413 });
			}
			return Response.json({ error: 'Course selection must be valid JSON.' }, { status: 400 });
		}

		const courses =
			body && typeof body === 'object' && 'courses' in body && Array.isArray(body.courses)
				? selectValidCourses(body.courses, true)
				: null;
		if (!courses) {
			return Response.json({ error: 'Choose at least one valid AP course.' }, { status: 400 });
		}

		await updateUserCourses(userId, courses);
		return Response.json({
			courses,
			selectedCourses: buildSelectedCourseEntries(courses)
		});
	},
	{ logLabel: 'Save onboarding courses error', errorMessage: 'Failed to save your courses' }
);
