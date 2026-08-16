import { randomBytes } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { authMembers, authOrganizations, authUsers } from '$lib/server/neon/schema';
import {
	MAX_FREE_GROUP_ORGS,
	SHARE_TOKEN_PREFIX,
	isOrgType,
	parseOrgType,
	personalOrgSlug,
	PERSONAL_ORG_NAME,
	type OrganizationRole,
	type OrgType,
	type UserOrganization
} from '$lib/auth/organization-types';

export type OrganizationMember = {
	memberId: string;
	userId: string;
	name: string;
	email: string;
	image: string | null;
	role: OrganizationRole;
};

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

export async function getOrganizationType(organizationId: string): Promise<OrgType | null> {
	const [row] = await getNeonDatabase()
		.select({ orgType: authOrganizations.orgType })
		.from(authOrganizations)
		.where(eq(authOrganizations.id, organizationId))
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
		.where(eq(authOrganizations.id, organizationId));
	return shareToken;
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
