import { getClassroomReport } from '#lib/auth/student-report.server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		if (!organizationId)
			return Response.json({ error: 'organizationId is required.' }, { status: 400 });
		const parseDate = (value: string | null): Date | undefined => {
			if (!value) return undefined;
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? undefined : date;
		};
		const parsePositiveInt = (value: string | null, fallback: number): number => {
			const parsed = Number.parseInt(value ?? '', 10);
			return Number.isFinite(parsed) ? parsed : fallback;
		};
		const report = await getClassroomReport(userId, organizationId, {
			page: parsePositiveInt(event.url.searchParams.get('page'), 1),
			limit: parsePositiveInt(event.url.searchParams.get('limit'), 50),
			course: event.url.searchParams.get('course')?.trim() || undefined,
			from: parseDate(event.url.searchParams.get('from')),
			to: parseDate(event.url.searchParams.get('to'))
		});
		if ('error' in report) return Response.json({ error: report.error }, { status: 403 });
		return Response.json(report.data);
	},
	{ logLabel: 'Classroom report error', errorMessage: 'Failed to load classroom report' }
);
