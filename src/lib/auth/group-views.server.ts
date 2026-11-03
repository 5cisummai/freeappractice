import { OrganizationPermissionError } from '#lib/auth/organization-types.js';
import {
	listUserOrganizations,
	listOrganizationMembers,
	listOrganizationActivity,
	listOrganizationLeaderboard,
	listOrganizationSharedSets
} from '#lib/auth/organization-queries.server.js';

async function requireGroupMembership(userId: string, organizationId: string) {
	const membership = (await listUserOrganizations(userId)).find(
		(organization) => organization.id === organizationId && organization.orgType === 'group'
	);
	if (!membership) {
		throw new OrganizationPermissionError('Study group membership is required.');
	}
	return membership;
}

export async function getGroupMembers(userId: string, organizationId: string) {
	const membership = await requireGroupMembership(userId, organizationId);
	const members = await listOrganizationMembers(organizationId);
	const canManage = membership.role === 'owner' || membership.role === 'admin';
	return members.map((member) => ({ ...member, email: canManage ? member.email : null }));
}

export async function getGroupMaterials(userId: string, organizationId: string) {
	const membership = await requireGroupMembership(userId, organizationId);
	return {
		materials: await listOrganizationSharedSets(organizationId),
		canManageMaterials: membership.role === 'owner' || membership.role === 'admin'
	};
}

export async function getGroupOverview(userId: string, organizationId: string, timeZone?: string) {
	await requireGroupMembership(userId, organizationId);
	const [orgActivity, orgSharedSets, orgLeaderboard] = await Promise.all([
		listOrganizationActivity(userId, organizationId),
		listOrganizationSharedSets(organizationId),
		listOrganizationLeaderboard(organizationId, timeZone)
	]);
	return { orgActivity, orgSharedSets, orgLeaderboard };
}
