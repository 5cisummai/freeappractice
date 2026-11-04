import { and, desc, eq, inArray } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import {
	getOrganizationTypeForUser,
	listClassroomReport,
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

const STUDENT_REPORT_DETAIL_LIMIT = 200;

async function classroomReportAccess(organizationId: string, teacherId: string) {
	if ((await getOrganizationTypeForUser(organizationId, teacherId)) !== 'school') {
		return { error: 'Classroom membership is required.', reason: 'membership' } as const;
	}
	const teacher = (await listUserOrganizations(teacherId)).find((org) => org.id === organizationId);
	if (!teacher || (teacher.role !== 'owner' && teacher.role !== 'admin')) {
		return { error: 'Teacher access is required.', reason: 'teacher' } as const;
	}
	return null;
}

export async function getClassroomReport(
	userId: string,
	organizationId: string,
	options: Parameters<typeof listClassroomReport>[1] = {}
) {
	const denial = await classroomReportAccess(organizationId, userId);
	if (denial) return denial;
	return { data: await listClassroomReport(organizationId, options) } as const;
}

export async function getStudentReportDetail(
	organizationId: string,
	teacherId: string,
	studentId: string
) {
	const denial = await classroomReportAccess(organizationId, teacherId);
	if (denial) return denial;
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
		return {
			error: 'Student is not enrolled in this classroom.',
			reason: 'student_not_found'
		} as const;
	const db = getNeonDatabase();
	const [mcq, frq, quizzes, exams] = await Promise.all([
		db
			.select()
			.from(mcqAttempts)
			.where(and(eq(mcqAttempts.organizationId, organizationId), eq(mcqAttempts.userId, studentId)))
			.orderBy(desc(mcqAttempts.attemptedAt))
			.limit(STUDENT_REPORT_DETAIL_LIMIT),
		db
			.select()
			.from(frqAttempts)
			.where(and(eq(frqAttempts.organizationId, organizationId), eq(frqAttempts.userId, studentId)))
			.orderBy(desc(frqAttempts.createdAt))
			.limit(STUDENT_REPORT_DETAIL_LIMIT),
		db
			.select()
			.from(quizAttempts)
			.where(
				and(eq(quizAttempts.organizationId, organizationId), eq(quizAttempts.userId, studentId))
			)
			.orderBy(desc(quizAttempts.completedAt))
			.limit(STUDENT_REPORT_DETAIL_LIMIT),
		db
			.select()
			.from(examAttempts)
			.where(
				and(eq(examAttempts.organizationId, organizationId), eq(examAttempts.userId, studentId))
			)
			.orderBy(desc(examAttempts.startedAt))
			.limit(STUDENT_REPORT_DETAIL_LIMIT)
	]);
	const quizIds = quizzes.map((quiz) => quiz.id);
	const quizQuestions = quizIds.length
		? await db
				.select()
				.from(quizAttemptQuestions)
				.where(inArray(quizAttemptQuestions.quizAttemptId, quizIds))
		: [];
	return { data: { studentId, mcq, frq, quizzes, quizQuestions, exams } } as const;
}
