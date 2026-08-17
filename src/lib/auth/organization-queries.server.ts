import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	authMembers,
	authOrganizations,
	authUsers,
	mcqAttempts,
	quizAttempts,
	sharedPracticeSets,
	userProgress
} from '$lib/server/neon/schema';
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
} from '$lib/auth/organization-types';

export type OrganizationMember = {
	memberId: string;
	userId: string;
	name: string;
	email: string | null;
	image: string | null;
	role: OrganizationRole;
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

export async function listOrganizationActivity(
	organizationId: string
): Promise<OrganizationActivityItem[]> {
	const memberRows = await getNeonDatabase()
		.select({ userId: authMembers.userId })
		.from(authMembers)
		.where(eq(authMembers.organizationId, organizationId));
	const userIds = memberRows.map((member) => member.userId);
	if (userIds.length === 0) return [];

	const cutoff = new Date(Date.now() - ORG_ACTIVITY_WINDOW_MS);
	const rows = await getNeonDatabase()
		.select({
			id: quizAttempts.id,
			userId: quizAttempts.userId,
			userName: authUsers.name,
			apClass: quizAttempts.apClass,
			unit: quizAttempts.unit,
			scorePercent: quizAttempts.scorePercent,
			quizTitle: sharedPracticeSets.title,
			completedAt: quizAttempts.completedAt
		})
		.from(quizAttempts)
		.innerJoin(authUsers, eq(quizAttempts.userId, authUsers.id))
		.leftJoin(sharedPracticeSets, eq(quizAttempts.sharedPracticeSetId, sharedPracticeSets.id))
		.where(and(inArray(quizAttempts.userId, userIds), gte(quizAttempts.completedAt, cutoff)))
		.orderBy(desc(quizAttempts.completedAt))
		.limit(ORG_ACTIVITY_LIMIT);

	return rows.map((row) => ({
		id: row.id,
		userId: row.userId,
		userName: row.userName,
		apClass: row.apClass,
		unit: row.unit,
		scorePercent: row.scorePercent,
		quizTitle: row.quizTitle,
		completedAt: row.completedAt.toISOString()
	}));
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
	if (orgType !== 'group') {
		throw new OrganizationPermissionError(
			'Organization quizzes are only available for group organizations.'
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
	const now = new Date();
	const rows = await getNeonDatabase()
		.select({
			id: sharedPracticeSets.id,
			slug: sharedPracticeSets.slug,
			title: sharedPracticeSets.title,
			apClass: sharedPracticeSets.apClass,
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
						inArray(quizAttempts.userId, memberUserIds)
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
		apClass: row.apClass,
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

	const userIds = members.map((member) => member.userId);
	const recentCutoff = new Date(Date.now() - 7 * 86_400_000);

	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());

	const [statsRows, unitsRows, streakResult] = await Promise.all([
		getNeonDatabase()
			.select({
				userId: mcqAttempts.userId,
				questionsLast7Days: sql<number>`count(*) FILTER (
					WHERE ${mcqAttempts.wasCorrect} IS NOT NULL
						AND ${mcqAttempts.attemptedAt} >= ${recentCutoff}
				)::int`,
				totalAttempts: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} IS NOT NULL)::int`,
				correctAttempts: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`
			})
			.from(mcqAttempts)
			.where(inArray(mcqAttempts.userId, userIds))
			.groupBy(mcqAttempts.userId),
		getNeonDatabase()
			.select({
				userId: userProgress.userId,
				unitsPracticed: count()
			})
			.from(userProgress)
			.where(and(inArray(userProgress.userId, userIds), gt(userProgress.totalAttempts, 0)))
			.groupBy(userProgress.userId),
		getNeonDatabase().execute<{ userId: string; currentStreak: number }>(sql`
			WITH activity_days AS (
				SELECT DISTINCT
					${mcqAttempts.userId} AS user_id,
					(${mcqAttempts.attemptedAt} AT TIME ZONE ${timeZone})::date AS day
				FROM ${mcqAttempts}
				WHERE ${inArray(mcqAttempts.userId, userIds)}
			),
			anchor AS (
				SELECT DISTINCT
					activity_days.user_id,
					CASE
						WHEN EXISTS (
							SELECT 1 FROM activity_days candidate
							WHERE candidate.user_id = activity_days.user_id
								AND candidate.day = ${today}::date
						) THEN ${today}::date
						WHEN EXISTS (
							SELECT 1 FROM activity_days candidate
							WHERE candidate.user_id = activity_days.user_id
								AND candidate.day = ${today}::date - 1
						) THEN ${today}::date - 1
						ELSE NULL::date
					END AS anchor_day
				FROM activity_days
			),
			ordered AS (
				SELECT
					activity_days.user_id,
					activity_days.day,
					anchor.anchor_day,
					row_number() OVER (
						PARTITION BY activity_days.user_id ORDER BY activity_days.day DESC
					)::int AS position
				FROM activity_days
				INNER JOIN anchor ON anchor.user_id = activity_days.user_id
				WHERE anchor.anchor_day IS NOT NULL
					AND activity_days.day <= anchor.anchor_day
			)
			SELECT
				user_id AS "userId",
				count(*) FILTER (
					WHERE day = anchor_day - (position - 1)
				)::int AS "currentStreak"
			FROM ordered
			GROUP BY user_id, anchor_day
		`)
	]);

	const statsMap = new Map(statsRows.map((row) => [row.userId, row]));
	const unitsMap = new Map(unitsRows.map((row) => [row.userId, Number(row.unitsPracticed)]));
	const streakMap = new Map(streakResult.rows.map((row) => [row.userId, row.currentStreak]));

	const entries: OrganizationLeaderboardEntry[] = members.map((member) => {
		const stats = statsMap.get(member.userId);
		const totalAttempts = stats?.totalAttempts ?? 0;
		const accuracyPercent =
			totalAttempts >= LEADERBOARD_MIN_ACCURACY_ATTEMPTS && stats
				? Math.round((stats.correctAttempts / totalAttempts) * 100)
				: null;

		return {
			userId: member.userId,
			name: member.name,
			image: member.image,
			questionsLast7Days: stats?.questionsLast7Days ?? 0,
			accuracyPercent,
			unitsPracticed: unitsMap.get(member.userId) ?? 0,
			currentStreak: streakMap.get(member.userId) ?? 0
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
