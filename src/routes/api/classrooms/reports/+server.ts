import {
	getOrganizationTypeForUser,
	listClassroomReport,
	listUserOrganizations
} from '#lib/auth/organization-queries.server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		if (!organizationId)
			return Response.json({ error: 'organizationId is required.' }, { status: 400 });
		if ((await getOrganizationTypeForUser(organizationId, userId)) !== 'school') {
			return Response.json({ error: 'Classroom membership is required.' }, { status: 403 });
		}
		const membership = (await listUserOrganizations(userId)).find(
			(org) => org.id === organizationId
		);
		if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
			return Response.json({ error: 'Teacher access is required.' }, { status: 403 });
		}
		const parseDate = (value: string | null): Date | undefined => {
			if (!value) return undefined;
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? undefined : date;
		};
		const report = await listClassroomReport(organizationId, {
			page: Number(event.url.searchParams.get('page') ?? 1),
			limit: Number(event.url.searchParams.get('limit') ?? 50),
			course: event.url.searchParams.get('course')?.trim() || undefined,
			from: parseDate(event.url.searchParams.get('from')),
			to: parseDate(event.url.searchParams.get('to'))
		});
		return Response.json(report);
	},
	{ logLabel: 'Classroom report error', errorMessage: 'Failed to load classroom report' }
);
