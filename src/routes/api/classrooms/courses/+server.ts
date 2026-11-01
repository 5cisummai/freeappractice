import { z } from 'zod';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	getOrganizationTypeForUser,
	listClassroomCourses,
	setClassroomCourses
} from '#lib/auth/organization-queries.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

const inputSchema = z
	.object({
		organizationId: z.string().trim().min(1),
		courses: z.array(z.string().trim().min(1).max(120)).max(20)
	})
	.strict();

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		if (!organizationId)
			return Response.json({ error: 'organizationId is required.' }, { status: 400 });
		try {
			if ((await getOrganizationTypeForUser(organizationId, userId)) !== 'school') {
				return Response.json({ error: 'Classroom membership is required.' }, { status: 403 });
			}
			const courses = await listClassroomCourses(organizationId);
			return Response.json({ organizationId, courses });
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Classroom course lookup error', errorMessage: 'Failed to load classroom courses' }
);

export const PUT = withAuthedHandler(
	async (event, userId) => {
		const parsed = inputSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'Invalid classroom courses.' }, { status: 400 });
		try {
			await setClassroomCourses(userId, parsed.data.organizationId, parsed.data.courses);
			return Response.json({
				organizationId: parsed.data.organizationId,
				courses: await listClassroomCourses(parsed.data.organizationId)
			});
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Classroom course update error', errorMessage: 'Failed to update classroom courses' }
);
