import { and, eq } from 'drizzle-orm';
import { OrganizationPermissionError, type OrgType } from '#lib/auth/organization-types.js';
import { getOrganizationTypeForUser } from '#lib/auth/organization-queries.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { authMembers, classroomCourses, practiceSessions } from '#lib/server/neon/schema.js';
import { isClassroomPracticeEnabled } from '#lib/flags.js';

export type PracticeContext = {
	organizationId: string | null;
};

export type PracticeSessionMode = 'mcq' | 'quiz' | 'frq' | 'exam';

export type AuthorizedPracticeSession = typeof practiceSessions.$inferSelect;

function classroomContext(organizationId: string, orgType: OrgType): PracticeContext {
	switch (orgType) {
		case 'school':
			return { organizationId };
		case 'personal':
		case 'group':
			return { organizationId: null };
		case 'enterprise':
			throw new OrganizationPermissionError('Enterprise practice is not available.');
		default: {
			const exhaustive: never = orgType;
			return exhaustive;
		}
	}
}

/**
 * Resolve an explicitly requested organization into a practice namespace.
 *
 * Personal and group organizations intentionally share the personal namespace.
 * A classroom is the only organization that owns practice data.
 */
export async function resolvePracticeContext(
	userId: string,
	requestedOrganizationId?: string | null
): Promise<PracticeContext> {
	if (!requestedOrganizationId) return { organizationId: null };
	const orgType = await getOrganizationTypeForUser(requestedOrganizationId, userId);
	if (!orgType) throw new OrganizationPermissionError('You are not a member of that organization.');
	if (orgType === 'school' && !(await isClassroomPracticeEnabled())) {
		throw new OrganizationPermissionError('Classroom practice is not available yet.');
	}
	return classroomContext(requestedOrganizationId, orgType);
}

export async function resolveRequestPracticeContext(
	locals: Pick<App.Locals, 'session'>,
	userId: string
): Promise<PracticeContext> {
	return resolvePracticeContext(userId, locals.session?.activeOrganizationId);
}

export async function assertPracticeContextAccess(
	userId: string,
	context: PracticeContext
): Promise<void> {
	if (!context.organizationId) return;
	const orgType = await getOrganizationTypeForUser(context.organizationId, userId);
	if (orgType !== 'school') {
		throw new OrganizationPermissionError('Classroom membership is required for this practice.');
	}
}

export async function startPracticeSession(
	userId: string,
	mode: PracticeSessionMode,
	context: PracticeContext,
	questionRefs: AuthorizedPracticeSession['questionRefs'],
	course: string | null = null
): Promise<AuthorizedPracticeSession> {
	await assertPracticeContextAccess(userId, context);
	if (context.organizationId && !course) {
		throw new OrganizationPermissionError('A classroom course is required to start practice.');
	}
	if (context.organizationId && course) {
		const [configured] = await getNeonDatabase()
			.select({ course: classroomCourses.course })
			.from(classroomCourses)
			.where(
				and(
					eq(classroomCourses.organizationId, context.organizationId),
					eq(classroomCourses.course, course)
				)
			)
			.limit(1);
		if (!configured) {
			throw new OrganizationPermissionError('That course is not configured for this classroom.');
		}
	}
	const [session] = await getNeonDatabase()
		.insert(practiceSessions)
		.values({
			id: crypto.randomUUID(),
			userId,
			organizationId: context.organizationId,
			mode,
			course,
			questionRefs
		})
		.returning();
	if (!session) throw new Error('Practice session could not be started.');
	return session;
}

/**
 * Every mutation re-checks current classroom membership. This deliberately
 * does not use the active organization in the session cookie.
 */
export async function requirePracticeSession(
	userId: string,
	sessionId: string,
	mode?: PracticeSessionMode
): Promise<AuthorizedPracticeSession> {
	const [session] = await getNeonDatabase()
		.select()
		.from(practiceSessions)
		.where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)))
		.limit(1);
	if (!session || session.status !== 'open' || (mode && session.mode !== mode)) {
		throw new OrganizationPermissionError('This practice session is no longer available.');
	}
	await assertPracticeContextAccess(userId, { organizationId: session.organizationId });
	return session;
}

export async function getPracticeSessionForUser(
	userId: string,
	sessionId: string,
	mode?: PracticeSessionMode
): Promise<AuthorizedPracticeSession> {
	const [session] = await getNeonDatabase()
		.select()
		.from(practiceSessions)
		.where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)))
		.limit(1);
	if (!session || (mode && session.mode !== mode)) {
		throw new OrganizationPermissionError('This practice session is no longer available.');
	}
	await assertPracticeContextAccess(userId, { organizationId: session.organizationId });
	return session;
}

export async function finishPracticeSession(
	userId: string,
	sessionId: string,
	status: 'completed' | 'cancelled' = 'completed'
): Promise<void> {
	const session = await requirePracticeSession(userId, sessionId);
	await getNeonDatabase()
		.update(practiceSessions)
		.set({ status, completedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(practiceSessions.id, session.id), eq(practiceSessions.userId, userId)));
}

export async function hasOrganizationMembership(
	userId: string,
	organizationId: string
): Promise<boolean> {
	const [membership] = await getNeonDatabase()
		.select({ id: authMembers.id })
		.from(authMembers)
		.where(and(eq(authMembers.userId, userId), eq(authMembers.organizationId, organizationId)))
		.limit(1);
	return Boolean(membership);
}
