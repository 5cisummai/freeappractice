import { auth } from '#lib/auth/server.js';
import {
	findOrganizationByShareToken,
	listUserOrganizations
} from '#lib/auth/organization-queries.server.js';

export async function joinOrganization(token: string, userId: string, headers: Headers) {
	const organization = await findOrganizationByShareToken(token);
	if (!organization || organization.orgType !== 'group') {
		return { error: 'That invite link is invalid or expired.', reason: 'invalid_invite' } as const;
	}

	const memberships = await listUserOrganizations(userId);
	if (memberships.some((org) => org.id === organization.id)) {
		await auth.api.setActiveOrganization({
			body: { organizationId: organization.id },
			headers
		});
		return { organizationId: organization.id, alreadyMember: true } as const;
	}

	await auth.api.addMember({
		body: {
			userId,
			role: 'member',
			organizationId: organization.id
		}
	});
	await auth.api.setActiveOrganization({
		body: { organizationId: organization.id },
		headers
	});
	return { organizationId: organization.id, alreadyMember: false } as const;
}
