import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { MAX_FREE_GROUP_ORGS, parseOrgType } from '$lib/auth/organization-types';
import {
	canCreateGroupOrg,
	countOwnedGroupOrgs,
	findPersonalOrganization,
	getOrganizationType,
	nextShareToken
} from '$lib/auth/organization-queries.server';
import { sendOrganizationInvitationEmail } from '$lib/auth/email.server';
import { getSiteUrl } from '$lib/site-url';

const organizationAdditionalFields = {
	orgType: {
		type: 'string' as const,
		required: true,
		input: true,
		defaultValue: 'group'
	},
	shareToken: {
		type: 'string' as const,
		required: false,
		input: false
	}
};

export function createOrganizationPlugin() {
	return organization({
		allowUserToCreateOrganization: async (user) => canCreateGroupOrg(user.id),
		requireEmailVerificationOnInvitation: true,
		sendInvitationEmail: async (data) => {
			const inviteLink = `${getSiteUrl()}/app/invite/${data.id}`;
			await sendOrganizationInvitationEmail({
				to: data.email,
				organizationName: data.organization.name,
				inviterName: data.inviter.user.name,
				inviteLink
			});
		},
		schema: {
			organization: {
				modelName: 'authOrganizations',
				additionalFields: organizationAdditionalFields
			},
			member: {
				modelName: 'authMembers'
			},
			invitation: {
				modelName: 'authInvitations'
			}
		},
		organizationHooks: {
			beforeCreateOrganization: async ({ organization: org, user }) => {
				const requested = parseOrgType(org.orgType) ?? 'group';
				if (requested === 'school' || requested === 'enterprise') {
					throw new APIError('BAD_REQUEST', {
						message: 'That organization type is not available yet.'
					});
				}
				if (requested === 'personal') {
					const existing = await findPersonalOrganization(user.id);
					if (existing) {
						throw new APIError('BAD_REQUEST', {
							message: 'You already have a personal organization.'
						});
					}
					return { data: { ...org, orgType: 'personal', shareToken: null } };
				}
				const ownedGroups = await countOwnedGroupOrgs(user.id);
				if (ownedGroups >= MAX_FREE_GROUP_ORGS) {
					throw new APIError('FORBIDDEN', {
						message: `You can create up to ${MAX_FREE_GROUP_ORGS} free group organizations.`
					});
				}
				return {
					data: {
						...org,
						orgType: 'group',
						shareToken: typeof org.shareToken === 'string' ? org.shareToken : nextShareToken()
					}
				};
			},
			beforeUpdateOrganization: async ({ member }) => {
				const orgType = await getOrganizationType(member.organizationId);
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'Personal organizations cannot be renamed.'
					});
				}
			},
			beforeDeleteOrganization: async ({ organization: org }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'Personal organizations cannot be deleted.'
					});
				}
			},
			beforeCreateInvitation: async ({ organization: org }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType !== 'group') {
					throw new APIError('FORBIDDEN', {
						message: 'Invites are only available for group organizations.'
					});
				}
			},
			beforeAddMember: async ({ organization: org }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'Personal organizations cannot have additional members.'
					});
				}
			},
			beforeRemoveMember: async ({ organization: org }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'You cannot leave your personal organization.'
					});
				}
			}
		}
	});
}
