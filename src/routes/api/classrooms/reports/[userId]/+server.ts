import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getStudentReportDetail } from '#lib/auth/student-report.server.js';

export const GET = withAuthedHandler(
	async (event, teacherId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		const studentId = event.params.userId;
		if (!organizationId || !studentId) {
			return Response.json({ error: 'organizationId and userId are required.' }, { status: 400 });
		}
		const result = await getStudentReportDetail(organizationId, teacherId, studentId);
		if ('error' in result)
			return Response.json(
				{ error: result.error },
				{ status: result.reason === 'student_not_found' ? 404 : 403 }
			);
		return Response.json(result.data);
	},
	{ logLabel: 'Classroom report detail error', errorMessage: 'Failed to load student report' }
);
