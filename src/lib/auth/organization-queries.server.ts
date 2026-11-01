import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import {
	authMembers,
	authOrganizations,
	authUsers,
	classroomCourses,
	classroomCreationGrants,
	classroomEnrollmentHistory,
	examAttempts,
	frqAttempts,
	mcqAttempts,
	organizationActivityPreferences,
	practiceActivityAudiences,
	practiceActivityEvents,
	quizAttempts,
	sharedPracticeSets
} from '#lib/server/neon/schema.js';
import {
	MAX_FREE_GROUP_ORGS,
	OrganizationPermissionError,
	SHARE_TOKEN_PREFIX,
	isOrgType,
	parseOrgType,
	personalOrgSlug,
	PERSONAL_ORG_NAME,
	type OrganizationActivityItem,
	type OrganizationLeaderboardEntry,
	type OrganizationRole,
	type OrganizationSharedSet,
	type OrgType,
	type UserOrganization
} from '#lib/auth/organization-types.js';

export type OrganizationMember = {
	memberId: string;
	userId: string;
	name: string;
	email: string | null;
	image: string | null;
	role: OrganizationRole;
};

export type ClassroomReportRow = {
	userId: string;
	name: string;
	email: string;
	role: OrganizationRole;
	current: boolean;
	mcqAttempts: number;
	mcqCorrect: number;
	mcqAccuracyPercent: number | null;
	unitsPracticed: number;
	quizAttempts: number;
	quizAveragePercent: number | null;
	frqAttempts: number;
	frqAveragePercent: number | null;
	examAttempts: number;
};

const ORG_ACTIVITY_LIMIT = 3;
const ORG_ACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function createShareToken(): string {
	return `${SHARE_TOKEN_PREFIX}${randomBytes(18).toString('base64url')}`;
}

function asRole(value: string): OrganizationRole {
	if (value === 'owner' || value === 'admin' || value === 'member') return value;
	return 'member';
}

export async function countOwnedGroupOrgs(userId: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ value: count() })
		.from(authMembers)
		.innerJoin(authOrganizations, eq(authMembers.organizationId, authOrganizations.id))
		.where(
			and(
				eq(authMembers.userId, userId),
				eq(authMembers.role, 'owner'),
				eq(authOrganizations.orgType, 'group')
			)
		);
	return Number(row?.value ?? 0);
}

export async function canCreateGroupOrg(userId: string): Promise<boolean> {
	return (await countOwnedGroupOrgs(userId)) < MAX_FREE_GROUP_ORGS;
}

export async function hasClassroomCreationGrant(userId: string): Promise<boolean> {
	const [row] = await getNeonDatabase()
		.select({ userId: classroomCreationGrants.userId })
		.from(classroomCreationGrants)
		.where(
			and(eq(classroomCreationGrants.userId, userId), isNull(classroomCreationGrants.revokedAt))
		)
		.limit(1);
	return Boolean(row);
}

export async function grantClassroomCreationAccess(
	userId: string,
	grantedBy: string
): Promise<void> {
	const now = new Date();
	await getNeonDatabase()
		.insert(classroomCreationGrants)
		.values({ userId, grantedBy, grantedAt: now, revokedAt: null, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: classroomCreationGrants.userId,
			set: { grantedBy, grantedAt: now, revokedAt: null, updatedAt: now }
		});
}

export async function revokeClassroomCreationAccess(userId: string): Promise<boolean> {
	const rows = await getNeonDatabase()
		.update(classroomCreationGrants)
		.set({ revokedAt: new Date(), updatedAt: new Date() })
		.where(
			and(eq(classroomCreationGrants.userId, userId), isNull(classroomCreationGrants.revokedAt))
		)
		.returning({ userId: classroomCreationGrants.userId });
	return rows.length > 0;
}

export async function listClassroomCreationAccess(): Promise<
	Array<{ userId: string; email: string; name: string; grantedBy: string; grantedAt: Date }>
> {
	return getNeonDatabase()
		.select({
			userId: classroomCreationGrants.userId,
			email: authUsers.email,
			name: authUsers.name,
			grantedBy: classroomCreationGrants.grantedBy,
			grantedAt: classroomCreationGrants.grantedAt
		})
		.from(classroomCreationGrants)
		.innerJoin(authUsers, eq(classroomCreationGrants.userId, authUsers.id))
		.where(isNull(classroomCreationGrants.revokedAt))
		.orderBy(desc(classroomCreationGrants.grantedAt));
}

export async function getVerifiedUserByEmail(
	email: string
): Promise<{ id: string; emailVerified: boolean } | null> {
	const [row] = await getNeonDatabase()
		.select({ id: authUsers.id, emailVerified: authUsers.emailVerified })
		.from(authUsers)
		.where(eq(authUsers.email, email.trim().toLowerCase()))
		.limit(1);
	return row ?? null;
}

export async function setOrganizationActivitySharing(
	userId: string,
	organizationId: string,
	enabled: boolean
): Promise<void> {
	const membership = await getOrganizationTypeForUser(organizationId, userId);
	if (membership !== 'group') {
		throw new OrganizationPermissionError('Activity sharing is only available for study groups.');
	}
	const db = getNeonDatabase();
	await db
		.insert(organizationActivityPreferences)
		.values({
			organizationId,
			userId,
			enabled,
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.onConflictDoUpdate({
			target: [
				organizationActivityPreferences.organizationId,
				organizationActivityPreferences.userId
			],
			set: { enabled, updatedAt: new Date() }
		});
	if (!enabled) {
		await db.delete(practiceActivityAudiences).where(
			and(
				eq(practiceActivityAudiences.organizationId, organizationId),
				sql`${practiceActivityAudiences.eventId} IN (
						SELECT ${practiceActivityEvents.id}
						FROM ${practiceActivityEvents}
						WHERE ${practiceActivityEvents.userId} = ${userId}
					)`
			)
		);
	}
}

export async function getOrganizationActivitySharing(
	userId: string,
	organizationId: string
): Promise<boolean> {
	if ((await getOrganizationTypeForUser(organizationId, userId)) !== 'group') {
		throw new OrganizationPermissionError('Activity sharing is only available for study groups.');
	}
	const [row] = await getNeonDatabase()
		.select({ enabled: organizationActivityPreferences.enabled })
		.from(organizationActivityPreferences)
		.where(
			and(
				eq(organizationActivityPreferences.organizationId, organizationId),
				eq(organizationActivityPreferences.userId, userId)
			)
		)
		.limit(1);
	return row?.enabled ?? false;
}

export async function listClassroomCourses(organizationId: string): Promise<string[]> {
	const rows = await getNeonDatabase()
		.select({ course: classroomCourses.course })
		.from(classroomCourses)
		.where(eq(classroomCourses.organizationId, organizationId))
		.orderBy(classroomCourses.position, classroomCourses.course);
	return rows.map((row) => row.course);
}

export async function setClassroomCourses(
	userId: string,
	organizationId: string,
	courses: string[]
): Promise<void> {
	const membership = (await listUserOrganizations(userId)).find((org) => org.id === organizationId);
	if (
		!membership ||
		membership.orgType !== 'school' ||
		(membership.role !== 'owner' && membership.role !== 'admin')
	) {
		throw new OrganizationPermissionError('Only classroom teachers can update classroom courses.');
	}
	const normalized = [...new Set(courses.map((course) => course.trim()).filter(Boolean))].slice(
		0,
		20
	);
	const db = getNeonDatabase();
	const deleteCourses = db
		.delete(classroomCourses)
		.where(eq(classroomCourses.organizationId, organizationId));
	if (!normalized.length) {
		await deleteCourses;
		return;
	}
	await db.batch([
		deleteCourses,
		db.insert(classroomCourses).values(
			normalized.map((course, position) => ({
				organizationId,
				course,
				position
			}))
		)
	]);
}

export type PublishPracticeActivityInput = {
	userId: string;
	sourceType: 'quiz' | 'exam' | 'frq';
	sourceId: string;
	course: string;
	unit: string;
	scorePercent: number | null;
	questionsAnswered: number;
	correctQuestions: number;
	completedAt: Date;
};

/**
 * Publish only personal completions. The event and all current enabled
 * audiences are written in one SQL statement.
 */
export async function publishPersonalPracticeActivity(
	input: PublishPracticeActivityInput
): Promise<void> {
	const eventId = crypto.randomUUID();
	await getNeonDatabase().execute(sql`
		WITH inserted AS (
			INSERT INTO ${practiceActivityEvents} (
				id,
				user_id,
				source_type,
				source_id,
				course,
				unit,
				score_percent,
				questions_answered,
				correct_questions,
				completed_at
			)
			VALUES (
				${eventId},
				${input.userId},
				${input.sourceType},
				${input.sourceId},
				${input.course},
				${input.unit},
				${input.scorePercent},
				${input.questionsAnswered},
				${input.correctQuestions},
				${input.completedAt}
			)
			ON CONFLICT (source_type, source_id) DO NOTHING
			RETURNING id
		)
		INSERT INTO ${practiceActivityAudiences} (event_id, organization_id)
		SELECT inserted.id, ${organizationActivityPreferences.organizationId}
		FROM inserted
		INNER JOIN ${organizationActivityPreferences}
			ON ${organizationActivityPreferences.userId} = ${input.userId}
			AND ${organizationActivityPreferences.enabled} = true
		INNER JOIN ${authMembers}
			ON ${authMembers.organizationId} = ${organizationActivityPreferences.organizationId}
			AND ${authMembers.userId} = ${organizationActivityPreferences.userId}
		INNER JOIN ${authOrganizations}
			ON ${authOrganizations.id} = ${organizationActivityPreferences.organizationId}
			AND ${authOrganizations.orgType} = 'group'
		ON CONFLICT DO NOTHING
	`);
}

export async function findPersonalOrganization(userId: string): Promise<UserOrganization | null> {
	const [row] = await getNeonDatabase()
		.select({
			id: authOrganizations.id,
			name: authOrganizations.name,
			slug: authOrganizations.slug,
			orgType: authOrganizations.orgType,
			shareToken: authOrganizations.shareToken,
			role: authMembers.role,
			createdAt: authOrganizations.createdAt
		})
		.from(authMembers)
		.innerJoin(authOrganizations, eq(authMembers.organizationId, authOrganizations.id))
		.where(
			and(
				eq(authMembers.userId, userId),
				eq(authOrganizations.orgType, 'personal'),
				eq(authMembers.role, 'owner')
			)
		)
		.limit(1);

	if (!row || !isOrgType(row.orgType)) return null;
	return { ...row, orgType: row.orgType, role: asRole(row.role) };
}

export async function listUserOrganizations(userId: string): Promise<UserOrganization[]> {
	const rows = await getNeonDatabase()
		.select({
			id: authOrganizations.id,
			name: authOrganizations.name,
			slug: authOrganizations.slug,
			orgType: authOrganizations.orgType,
			shareToken: authOrganizations.shareToken,
			role: authMembers.role,
			createdAt: authOrganizations.createdAt
		})
		.from(authMembers)
		.innerJoin(authOrganizations, eq(authMembers.organizationId, authOrganizations.id))
		.where(eq(authMembers.userId, userId));

	const orgs: UserOrganization[] = [];
	for (const row of rows) {
		const orgType = parseOrgType(row.orgType);
		if (!orgType) continue;
		orgs.push({ ...row, orgType, role: asRole(row.role) });
	}

	orgs.sort((a, b) => {
		if (a.orgType === 'personal' && b.orgType !== 'personal') return -1;
		if (a.orgType !== 'personal' && b.orgType === 'personal') return 1;
		return a.name.localeCompare(b.name);
	});
	return orgs;
}

export async function listOrganizationMembers(
	organizationId: string
): Promise<OrganizationMember[]> {
	const rows = await getNeonDatabase()
		.select({
			memberId: authMembers.id,
			userId: authUsers.id,
			name: authUsers.name,
			email: authUsers.email,
			image: authUsers.image,
			role: authMembers.role
		})
		.from(authMembers)
		.innerJoin(authUsers, eq(authMembers.userId, authUsers.id))
		.where(eq(authMembers.organizationId, organizationId));

	const members: OrganizationMember[] = rows.map((row) => ({
		...row,
		role: asRole(row.role)
	}));

	const roleRank: Record<OrganizationRole, number> = {
		owner: 0,
		admin: 1,
		member: 2
	};
	members.sort((a, b) => {
		const rank = roleRank[a.role] - roleRank[b.role];
		if (rank !== 0) return rank;
		return a.name.localeCompare(b.name);
	});
	return members;
}

export async function listClassroomReport(
	organizationId: string,
	options: { page?: number; limit?: number; course?: string; from?: Date; to?: Date } = {}
): Promise<{ rows: ClassroomReportRow[]; total: number; page: number; limit: number }> {
	const orgType = await getOrganizationType(organizationId);
	if (orgType !== 'school') {
		throw new OrganizationPermissionError('Classroom reports are only available for classrooms.');
	}
	const currentMembers = await listOrganizationMembers(organizationId);
	const historyRows = await getNeonDatabase()
		.select({
			userId: classroomEnrollmentHistory.userId,
			role: classroomEnrollmentHistory.role,
			leftAt: classroomEnrollmentHistory.leftAt
		})
		.from(classroomEnrollmentHistory)
		.where(eq(classroomEnrollmentHistory.organizationId, organizationId));
	const userIds = [
		...new Set(historyRows.map((row) => row.userId).concat(currentMembers.map((row) => row.userId)))
	];
	if (!userIds.length) return { rows: [], total: 0, page: 1, limit: options.limit ?? 50 };
	const users = await getNeonDatabase()
		.select({ id: authUsers.id, name: authUsers.name, email: authUsers.email })
		.from(authUsers)
		.where(inArray(authUsers.id, userIds));
	const currentByUser = new Map(currentMembers.map((member) => [member.userId, member]));
	const userById = new Map(users.map((user) => [user.id, user]));
	const mcqRows = await getNeonDatabase()
		.select({
			userId: mcqAttempts.userId,
			attempts: count(),
			correct: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`,
			units: sql<number>`count(distinct ${mcqAttempts.course} || chr(0) || ${mcqAttempts.unit})::int`
		})
		.from(mcqAttempts)
		.where(
			and(
				eq(mcqAttempts.organizationId, organizationId),
				inArray(mcqAttempts.userId, userIds),
				options.course ? eq(mcqAttempts.course, options.course) : undefined,
				options.from ? gte(mcqAttempts.attemptedAt, options.from) : undefined,
				options.to ? sql`${mcqAttempts.attemptedAt} <= ${options.to}` : undefined
			)
		)
		.groupBy(mcqAttempts.userId);
	const [quizRows, frqRows, examRows] = await Promise.all([
		getNeonDatabase()
			.select({
				userId: quizAttempts.userId,
				attempts: count(),
				average: sql<number>`round(avg(${quizAttempts.scorePercent}))::int`
			})
			.from(quizAttempts)
			.where(
				and(
					eq(quizAttempts.organizationId, organizationId),
					inArray(quizAttempts.userId, userIds),
					options.course ? eq(quizAttempts.course, options.course) : undefined,
					options.from ? gte(quizAttempts.completedAt, options.from) : undefined,
					options.to ? sql`${quizAttempts.completedAt} <= ${options.to}` : undefined
				)
			)
			.groupBy(quizAttempts.userId),
		getNeonDatabase()
			.select({
				userId: frqAttempts.userId,
				attempts: count(),
				average: sql<number>`round(avg(${frqAttempts.percentage}))::int`
			})
			.from(frqAttempts)
			.where(
				and(
					eq(frqAttempts.organizationId, organizationId),
					eq(frqAttempts.status, 'graded'),
					inArray(frqAttempts.userId, userIds),
					options.course ? eq(frqAttempts.course, options.course) : undefined,
					options.from ? gte(frqAttempts.createdAt, options.from) : undefined,
					options.to ? sql`${frqAttempts.createdAt} <= ${options.to}` : undefined
				)
			)
			.groupBy(frqAttempts.userId),
		getNeonDatabase()
			.select({ userId: examAttempts.userId, attempts: count() })
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.organizationId, organizationId),
					eq(examAttempts.status, 'submitted'),
					inArray(examAttempts.userId, userIds),
					options.course ? eq(examAttempts.course, options.course) : undefined,
					options.from ? gte(examAttempts.submittedAt, options.from) : undefined,
					options.to ? sql`${examAttempts.submittedAt} <= ${options.to}` : undefined
				)
			)
			.groupBy(examAttempts.userId)
	]);
	const mcqByUser = new Map(mcqRows.map((row) => [row.userId, row]));
	const quizByUser = new Map(quizRows.map((row) => [row.userId, row]));
	const frqByUser = new Map(frqRows.map((row) => [row.userId, row]));
	const examByUser = new Map(examRows.map((row) => [row.userId, row]));
	const rows = userIds
		.map((userId) => {
			const user = userById.get(userId);
			if (!user) return null;
			const mcq = mcqByUser.get(userId);
			const quiz = quizByUser.get(userId);
			const frq = frqByUser.get(userId);
			const exam = examByUser.get(userId);
			const current = currentByUser.get(userId);
			const role = asRole(
				current?.role ?? historyRows.find((row) => row.userId === userId)?.role ?? 'member'
			);
			const mcqAttempts = Number(mcq?.attempts ?? 0);
			return {
				userId,
				name: user.name,
				email: user.email,
				role,
				current: Boolean(current),
				mcqAttempts,
				mcqCorrect: Number(mcq?.correct ?? 0),
				mcqAccuracyPercent:
					mcqAttempts > 0 ? Math.round((Number(mcq?.correct ?? 0) / mcqAttempts) * 100) : null,
				unitsPracticed: Number(mcq?.units ?? 0),
				quizAttempts: Number(quiz?.attempts ?? 0),
				quizAveragePercent: quiz ? Number(quiz.average) : null,
				frqAttempts: Number(frq?.attempts ?? 0),
				frqAveragePercent: frq ? Number(frq.average) : null,
				examAttempts: Number(exam?.attempts ?? 0)
			};
		})
		.filter((row): row is ClassroomReportRow => Boolean(row))
		.filter((row) => row.role === 'member')
		.sort((left, right) => left.name.localeCompare(right.name));
	const page = Math.max(options.page ?? 1, 1);
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
	return { rows: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
}

export type OrganizationActivityPage = {
	items: OrganizationActivityItem[];
	nextCursor: string | null;
};

type OrganizationActivityCursor = {
	completedAt: string;
	id: string;
};

function decodeOrganizationActivityCursor(
	value: string | undefined
): OrganizationActivityCursor | null {
	if (!value) return null;
	try {
		const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
		if (!decoded || typeof decoded !== 'object') throw new Error('Invalid cursor.');
		const cursor = decoded as Record<string, unknown>;
		if (
			typeof cursor.completedAt !== 'string' ||
			Number.isNaN(new Date(cursor.completedAt).getTime()) ||
			typeof cursor.id !== 'string' ||
			!cursor.id
		) {
			throw new Error('Invalid cursor.');
		}
		return { completedAt: cursor.completedAt, id: cursor.id };
	} catch {
		throw new Error('Invalid activity cursor.');
	}
}

function encodeOrganizationActivityCursor(cursor: OrganizationActivityCursor): string {
	return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export async function listOrganizationActivity(
	userId: string,
	organizationId: string
): Promise<OrganizationActivityItem[]> {
	const page = await listOrganizationActivityPage(userId, organizationId, {
		limit: ORG_ACTIVITY_LIMIT
	});
	return page.items;
}

export async function listOrganizationActivityPage(
	userId: string,
	organizationId: string,
	options: { cursor?: string; limit?: number } = {}
): Promise<OrganizationActivityPage> {
	if ((await getOrganizationTypeForUser(organizationId, userId)) !== 'group') {
		throw new OrganizationPermissionError('Activity feeds are only available for study groups.');
	}
	const cutoff = new Date(Date.now() - ORG_ACTIVITY_WINDOW_MS);
	const cursor = decodeOrganizationActivityCursor(options.cursor);
	const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
	const rows = await getNeonDatabase()
		.select({
			id: practiceActivityEvents.id,
			userId: practiceActivityEvents.userId,
			userName: authUsers.name,
			course: practiceActivityEvents.course,
			unit: practiceActivityEvents.unit,
			scorePercent: practiceActivityEvents.scorePercent,
			quizTitle: sql<string | null>`NULL`,
			completedAt: practiceActivityEvents.completedAt
		})
		.from(practiceActivityAudiences)
		.innerJoin(
			practiceActivityEvents,
			eq(practiceActivityAudiences.eventId, practiceActivityEvents.id)
		)
		.innerJoin(
			authMembers,
			and(
				eq(authMembers.organizationId, practiceActivityAudiences.organizationId),
				eq(authMembers.userId, practiceActivityEvents.userId)
			)
		)
		.innerJoin(authUsers, eq(practiceActivityEvents.userId, authUsers.id))
		.where(
			and(
				eq(practiceActivityAudiences.organizationId, organizationId),
				gte(practiceActivityEvents.completedAt, cutoff),
				cursor
					? or(
							lt(practiceActivityEvents.completedAt, new Date(cursor.completedAt)),
							and(
								eq(practiceActivityEvents.completedAt, new Date(cursor.completedAt)),
								lt(practiceActivityEvents.id, cursor.id)
							)
						)
					: undefined
			)
		)
		.orderBy(desc(practiceActivityEvents.completedAt), desc(practiceActivityEvents.id))
		.limit(limit + 1);

	const hasNextPage = rows.length > limit;
	const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
	const items = pageRows.map((row) => ({
		id: row.id,
		userId: row.userId,
		userName: row.userName,
		course: row.course,
		unit: row.unit,
		scorePercent: row.scorePercent ?? 0,
		quizTitle: row.quizTitle,
		completedAt: row.completedAt.toISOString()
	}));
	const last = pageRows.at(-1);
	return {
		items,
		nextCursor:
			hasNextPage && last
				? encodeOrganizationActivityCursor({
						completedAt: last.completedAt.toISOString(),
						id: last.id
					})
				: null
	};
}

export async function getOrganizationType(organizationId: string): Promise<OrgType | null> {
	const [row] = await getNeonDatabase()
		.select({ orgType: authOrganizations.orgType })
		.from(authOrganizations)
		.where(eq(authOrganizations.id, organizationId))
		.limit(1);
	return parseOrgType(row?.orgType);
}

export async function getOrganizationTypeForUser(
	organizationId: string,
	userId: string
): Promise<OrgType | null> {
	const [row] = await getNeonDatabase()
		.select({ orgType: authOrganizations.orgType })
		.from(authMembers)
		.innerJoin(authOrganizations, eq(authMembers.organizationId, authOrganizations.id))
		.where(and(eq(authMembers.organizationId, organizationId), eq(authMembers.userId, userId)))
		.limit(1);
	return parseOrgType(row?.orgType);
}

export async function findOrganizationByShareToken(
	shareToken: string
): Promise<{ id: string; name: string; orgType: OrgType } | null> {
	const [row] = await getNeonDatabase()
		.select({
			id: authOrganizations.id,
			name: authOrganizations.name,
			orgType: authOrganizations.orgType
		})
		.from(authOrganizations)
		.where(eq(authOrganizations.shareToken, shareToken))
		.limit(1);
	const orgType = parseOrgType(row?.orgType);
	if (!row || !orgType) return null;
	return { id: row.id, name: row.name, orgType };
}

export async function ensureOrganizationShareToken(organizationId: string): Promise<string> {
	const [existing] = await getNeonDatabase()
		.select({ shareToken: authOrganizations.shareToken, orgType: authOrganizations.orgType })
		.from(authOrganizations)
		.where(eq(authOrganizations.id, organizationId))
		.limit(1);
	if (existing?.shareToken) return existing.shareToken;
	if (parseOrgType(existing?.orgType) !== 'group') {
		throw new Error('Invite links are only available for group organizations.');
	}

	const shareToken = createShareToken();
	await getNeonDatabase()
		.update(authOrganizations)
		.set({ shareToken, updatedAt: new Date() })
		.where(and(eq(authOrganizations.id, organizationId), isNull(authOrganizations.shareToken)));
	const [persisted] = await getNeonDatabase()
		.select({ shareToken: authOrganizations.shareToken })
		.from(authOrganizations)
		.where(eq(authOrganizations.id, organizationId))
		.limit(1);
	if (!persisted?.shareToken) throw new Error('Could not create an invite link.');
	return persisted.shareToken;
}

export function nextShareToken(): string {
	return createShareToken();
}

/** Create the user's personal org if missing. Does not go through Better Auth create limits. */
export async function ensurePersonalOrganization(userId: string): Promise<UserOrganization> {
	const existing = await findPersonalOrganization(userId);
	if (existing) return existing;

	const db = getNeonDatabase();
	const orgId = crypto.randomUUID();
	const now = new Date();
	const organization = {
		id: orgId,
		name: PERSONAL_ORG_NAME,
		slug: personalOrgSlug(userId),
		orgType: 'personal' as const,
		shareToken: null,
		createdAt: now,
		updatedAt: now
	};

	try {
		await db.batch([
			db.insert(authOrganizations).values(organization),
			db.insert(authMembers).values({
				id: crypto.randomUUID(),
				organizationId: orgId,
				userId,
				role: 'owner',
				createdAt: now
			})
		]);
	} catch {
		const raced = await findPersonalOrganization(userId);
		if (raced) return raced;
		throw new Error('Could not create personal organization');
	}

	return {
		id: orgId,
		name: organization.name,
		slug: organization.slug,
		orgType: 'personal',
		shareToken: null,
		role: 'owner',
		createdAt: now
	};
}

const ORG_SHARED_SET_LIMIT = 10;
const LEADERBOARD_MIN_ACCURACY_ATTEMPTS = 20;

export async function assertCanAttachSharedSetToOrganization(
	userId: string,
	organizationId: string
): Promise<void> {
	const orgType = await getOrganizationTypeForUser(organizationId, userId);
	if (orgType !== 'group' && orgType !== 'school') {
		throw new OrganizationPermissionError(
			'Organization quizzes are only available for groups and classrooms.'
		);
	}

	const memberships = await listUserOrganizations(userId);
	const membership = memberships.find((org) => org.id === organizationId);
	if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
		throw new OrganizationPermissionError(
			'You do not have permission to share quizzes with this organization.'
		);
	}
}

export async function listOrganizationSharedSets(
	organizationId: string
): Promise<OrganizationSharedSet[]> {
	const orgType = await getOrganizationType(organizationId);
	const now = new Date();
	const rows = await getNeonDatabase()
		.select({
			id: sharedPracticeSets.id,
			slug: sharedPracticeSets.slug,
			title: sharedPracticeSets.title,
			course: sharedPracticeSets.course,
			unit: sharedPracticeSets.unit,
			itemCount: sharedPracticeSets.itemCount,
			expiresAt: sharedPracticeSets.expiresAt,
			createdAt: sharedPracticeSets.createdAt,
			creatorName: authUsers.name
		})
		.from(sharedPracticeSets)
		.leftJoin(authUsers, eq(sharedPracticeSets.creatorUserId, authUsers.id))
		.where(
			and(
				eq(sharedPracticeSets.organizationId, organizationId),
				eq(sharedPracticeSets.status, 'active'),
				gt(sharedPracticeSets.expiresAt, now)
			)
		)
		.orderBy(desc(sharedPracticeSets.createdAt))
		.limit(ORG_SHARED_SET_LIMIT);

	if (rows.length === 0) return [];

	const memberRows = await getNeonDatabase()
		.select({ userId: authMembers.userId })
		.from(authMembers)
		.where(eq(authMembers.organizationId, organizationId));
	const memberUserIds = memberRows.map((member) => member.userId);

	const setIds = rows.map((row) => row.id);
	const completionRows = memberUserIds.length
		? await getNeonDatabase()
				.select({
					sharedPracticeSetId: quizAttempts.sharedPracticeSetId,
					completionCount: sql<number>`count(distinct ${quizAttempts.userId})::int`
				})
				.from(quizAttempts)
				.where(
					and(
						inArray(quizAttempts.sharedPracticeSetId, setIds),
						inArray(quizAttempts.userId, memberUserIds),
						sql`${quizAttempts.organizationId} IS NOT DISTINCT FROM ${
							orgType === 'school' ? organizationId : null
						}`
					)
				)
				.groupBy(quizAttempts.sharedPracticeSetId)
		: [];

	const completionMap = new Map(
		completionRows
			.filter((row) => row.sharedPracticeSetId)
			.map((row) => [row.sharedPracticeSetId!, row.completionCount])
	);

	return rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		title: row.title,
		course: row.course,
		unit: row.unit,
		itemCount: row.itemCount,
		expiresAt: row.expiresAt.toISOString(),
		createdAt: row.createdAt.toISOString(),
		creatorName: row.creatorName,
		completionCount: completionMap.get(row.id) ?? 0
	}));
}

export async function listOrganizationLeaderboard(
	organizationId: string,
	timeZone = 'UTC'
): Promise<OrganizationLeaderboardEntry[]> {
	const members = await listOrganizationMembers(organizationId);
	if (members.length === 0) return [];

	const recentCutoff = new Date(Date.now() - 7 * 86_400_000);
	const dayKey = sql<string>`to_char((${practiceActivityEvents.completedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;
	const audienceMembership = and(
		eq(authMembers.organizationId, practiceActivityAudiences.organizationId),
		eq(authMembers.userId, practiceActivityEvents.userId)
	);

	const [eventRows, streakDayRows] = await Promise.all([
		getNeonDatabase()
			.select({
				userId: practiceActivityEvents.userId,
				completedAt: practiceActivityEvents.completedAt,
				course: practiceActivityEvents.course,
				unit: practiceActivityEvents.unit,
				questionsAnswered: practiceActivityEvents.questionsAnswered,
				correctQuestions: practiceActivityEvents.correctQuestions
			})
			.from(practiceActivityAudiences)
			.innerJoin(
				practiceActivityEvents,
				eq(practiceActivityAudiences.eventId, practiceActivityEvents.id)
			)
			.innerJoin(authMembers, audienceMembership)
			.where(
				and(
					eq(practiceActivityAudiences.organizationId, organizationId),
					gte(practiceActivityEvents.completedAt, recentCutoff)
				)
			),
		getNeonDatabase()
			.selectDistinct({
				userId: practiceActivityEvents.userId,
				day: dayKey
			})
			.from(practiceActivityAudiences)
			.innerJoin(
				practiceActivityEvents,
				eq(practiceActivityAudiences.eventId, practiceActivityEvents.id)
			)
			.innerJoin(authMembers, audienceMembership)
			.where(eq(practiceActivityAudiences.organizationId, organizationId))
	]);
	const eventsByUser = new Map<string, typeof eventRows>();
	for (const row of eventRows) {
		const events = eventsByUser.get(row.userId) ?? [];
		events.push(row);
		eventsByUser.set(row.userId, events);
	}
	const daysByUser = new Map<string, Set<string>>();
	for (const row of streakDayRows) {
		const days = daysByUser.get(row.userId) ?? new Set<string>();
		days.add(row.day);
		daysByUser.set(row.userId, days);
	}

	const entries: OrganizationLeaderboardEntry[] = members.map((member) => {
		const events = eventsByUser.get(member.userId) ?? [];
		const totalAttempts = events.reduce((total, event) => total + event.questionsAnswered, 0);
		const correctAttempts = events.reduce((total, event) => total + event.correctQuestions, 0);
		const units = new Set(events.map((event) => `${event.course}\u0000${event.unit}`));
		const days = daysByUser.get(member.userId) ?? new Set<string>();
		let currentStreak = 0;
		const cursor = new Date();
		while (
			days.has(
				new Intl.DateTimeFormat('en-CA', {
					timeZone,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(cursor)
			)
		) {
			currentStreak += 1;
			cursor.setUTCDate(cursor.getUTCDate() - 1);
		}
		const accuracyPercent =
			totalAttempts >= LEADERBOARD_MIN_ACCURACY_ATTEMPTS
				? Math.round((correctAttempts / totalAttempts) * 100)
				: null;

		return {
			userId: member.userId,
			name: member.name,
			image: member.image,
			questionsLast7Days: totalAttempts,
			accuracyPercent,
			unitsPracticed: units.size,
			currentStreak
		};
	});

	entries.sort((left, right) => {
		if (right.questionsLast7Days !== left.questionsLast7Days) {
			return right.questionsLast7Days - left.questionsLast7Days;
		}
		if ((right.accuracyPercent ?? 0) !== (left.accuracyPercent ?? 0)) {
			return (right.accuracyPercent ?? 0) - (left.accuracyPercent ?? 0);
		}
		return left.name.localeCompare(right.name);
	});

	return entries;
}
