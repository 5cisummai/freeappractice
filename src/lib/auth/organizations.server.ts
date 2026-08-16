import { auth } from '$lib/auth/server';
import {
	ensurePersonalOrganization,
	ensureOrganizationShareToken,
	getOrganizationType,
	listUserOrganizations
} from '$lib/auth/organization-queries.server';
import {
	orgUsesUserSuper,
	type OrgType,
	type UserOrganization
} from '$lib/auth/organization-types';

export type AppOrganizationsPayload = {
	organizations: UserOrganization[];
	activeOrganization: UserOrganization | null;
	ownedGroupCount: number;
};

function ownedGroupCount(organizations: UserOrganization[]): number {
	return organizations.filter((org) => org.orgType === 'group' && org.role === 'owner').length;
}

export async function loadAppOrganizations(
	userId: string,
	activeOrganizationId: string | null | undefined,
	headers: Headers
): Promise<AppOrganizationsPayload> {
	await ensurePersonalOrganization(userId);
	const organizations = await listUserOrganizations(userId);
	const personal = organizations.find((org) => org.orgType === 'personal') ?? organizations[0];
	const activeFromSession = activeOrganizationId
		? organizations.find((org) => org.id === activeOrganizationId)
		: undefined;

	if (!activeFromSession && personal) {
		await auth.api.setActiveOrganization({
			body: { organizationId: personal.id },
			headers
		});
		return {
			organizations,
			activeOrganization: personal,
			ownedGroupCount: ownedGroupCount(organizations)
		};
	}

	return {
		organizations,
		activeOrganization: activeFromSession ?? personal ?? null,
		ownedGroupCount: ownedGroupCount(organizations)
	};
}

export async function getActiveOrgTypeForRequest(
	locals: Pick<App.Locals, 'session' | 'activeOrganizationType'>
): Promise<OrgType | null> {
	if (locals.activeOrganizationType) return locals.activeOrganizationType;
	const organizationId = locals.session?.activeOrganizationId;
	if (!organizationId) return 'personal';
	const orgType = await getOrganizationType(organizationId);
	if (orgType) locals.activeOrganizationType = orgType;
	return orgType;
}

export async function inviteLinkForOrganization(
	userId: string,
	organizationId: string,
	origin: string
): Promise<string | null> {
	const memberships = await listUserOrganizations(userId);
	const membership = memberships.find((org) => org.id === organizationId);
	if (!membership || membership.orgType !== 'group') return null;
	if (membership.role !== 'owner' && membership.role !== 'admin') return null;
	const token = await ensureOrganizationShareToken(organizationId);
	return `${origin}/app/invite/${token}`;
}

export async function activeOrgUsesUserSuper(
	locals: Pick<App.Locals, 'session' | 'activeOrganizationType'>
): Promise<boolean> {
	const orgType = await getActiveOrgTypeForRequest(locals);
	if (!orgType) return true;
	return orgUsesUserSuper(orgType);
}
