import { and, eq, inArray } from 'drizzle-orm';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import {
	getOrganizationTypeForUser,
	listUserOrganizations
} from '#lib/auth/organization-queries.server.js';
import {
	classroomEnrollmentHistory,
	examAttempts,
	frqAttempts,
	mcqAttempts,
	quizAttemptQuestions,
	quizAttempts
} from '#lib/server/neon/schema.js';

export const GET = withAuthedHandler(
	async (event, teacherId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		const studentId = event.params.userId;
		if (!organizationId || !studentId) {
			return Response.json({ error: 'organizationId and userId are required.' }, { status: 400 });
		}
		if ((await getOrganizationTypeForUser(organizationId, teacherId)) !== 'school') {
			return Response.json({ error: 'Classroom membership is required.' }, { status: 403 });
		}
		const teacher = (await listUserOrganizations(teacherId)).find(
			(org) => org.id === organizationId
		);
		if (!teacher || (teacher.role !== 'owner' && teacher.role !== 'admin')) {
			return Response.json({ error: 'Teacher access is required.' }, { status: 403 });
		}
		const [enrollment] = await getNeonDatabase()
			.select({ id: classroomEnrollmentHistory.id })
			.from(classroomEnrollmentHistory)
			.where(
				and(
					eq(classroomEnrollmentHistory.organizationId, organizationId),
					eq(classroomEnrollmentHistory.userId, studentId)
				)
			)
			.limit(1);
		if (!enrollment)
			return Response.json(
				{ error: 'Student is not enrolled in this classroom.' },
				{ status: 404 }
			);
		const db = getNeonDatabase();
		const [mcq, frq, quizzes, exams] = await Promise.all([
			db
				.select()
				.from(mcqAttempts)
				.where(
					and(eq(mcqAttempts.organizationId, organizationId), eq(mcqAttempts.userId, studentId))
				),
			db
				.select()
				.from(frqAttempts)
				.where(
					and(eq(frqAttempts.organizationId, organizationId), eq(frqAttempts.userId, studentId))
				),
			db
				.select()
				.from(quizAttempts)
				.where(
					and(eq(quizAttempts.organizationId, organizationId), eq(quizAttempts.userId, studentId))
				),
			db
				.select()
				.from(examAttempts)
				.where(
					and(eq(examAttempts.organizationId, organizationId), eq(examAttempts.userId, studentId))
				)
		]);
		const quizIds = quizzes.map((quiz) => quiz.id);
		const quizQuestions = quizIds.length
			? await db
					.select()
					.from(quizAttemptQuestions)
					.where(inArray(quizAttemptQuestions.quizAttemptId, quizIds))
			: [];
		return Response.json({ studentId, mcq, frq, quizzes, quizQuestions, exams });
	},
	{ logLabel: 'Classroom report detail error', errorMessage: 'Failed to load student report' }
);
