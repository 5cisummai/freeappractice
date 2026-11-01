import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { MAX_FREE_GROUP_ORGS, parseOrgType } from '#lib/auth/organization-types.js';
import {
	canCreateGroupOrg,
	countOwnedGroupOrgs,
	findPersonalOrganization,
	getVerifiedUserByEmail,
	getOrganizationType,
	hasClassroomCreationGrant,
	nextShareToken
} from '#lib/auth/organization-queries.server.js';
import { sendOrganizationInvitationEmail } from '#lib/auth/email.server.js';
import { getSiteUrl } from '#lib/site-url.js';
import { isClassroomPracticeEnabled } from '#lib/flags.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import {
	classroomEnrollmentHistory,
	organizationActivityPreferences,
	practiceActivityAudiences,
	practiceActivityEvents
} from '#lib/server/neon/schema.js';

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
		allowUserToCreateOrganization: async (user) =>
			(await canCreateGroupOrg(user.id)) || (await hasClassroomCreationGrant(user.id)),
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
				if (requested === 'enterprise') {
					throw new APIError('BAD_REQUEST', {
						message: 'That organization type is not available yet.'
					});
				}
				if (requested === 'school') {
					if (!(await isClassroomPracticeEnabled())) {
						throw new APIError('FORBIDDEN', {
							message: 'Classroom creation is not available yet.'
						});
					}
					if (!user.emailVerified || !(await hasClassroomCreationGrant(user.id))) {
						throw new APIError('FORBIDDEN', {
							message: 'A verified teacher with classroom creation access is required.'
						});
					}
					return { data: { ...org, orgType: 'school', shareToken: null } };
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
			beforeCreateInvitation: async ({ organization: org, invitation }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType !== 'group' && orgType !== 'school') {
					throw new APIError('FORBIDDEN', {
						message: 'Invites are only available for groups and classrooms.'
					});
				}
				if (orgType === 'school') {
					const invited = await getVerifiedUserByEmail(invitation.email);
					if (!invited?.emailVerified) {
						throw new APIError('BAD_REQUEST', {
							message: 'Classroom invitations require an existing verified account.'
						});
					}
					if (invitation.role !== 'member' && !(await hasClassroomCreationGrant(invited.id))) {
						throw new APIError('FORBIDDEN', {
							message: 'Additional classroom teachers need classroom creation access.'
						});
					}
				}
			},
			beforeAddMember: async ({ organization: org, member, user }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'Personal organizations cannot have additional members.'
					});
				}
				if (orgType === 'school') {
					if (!user.emailVerified) {
						throw new APIError('BAD_REQUEST', {
							message: 'Classroom members must have verified email addresses.'
						});
					}
					if (member.role !== 'member' && !(await hasClassroomCreationGrant(user.id))) {
						throw new APIError('FORBIDDEN', {
							message: 'Classroom teachers need classroom creation access.'
						});
					}
				}
			},
			beforeRemoveMember: async ({ organization: org }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType === 'personal') {
					throw new APIError('FORBIDDEN', {
						message: 'You cannot leave your personal organization.'
					});
				}
			},
			beforeUpdateMemberRole: async ({ organization: org, member, newRole }) => {
				const orgType = parseOrgType(org.orgType) ?? (await getOrganizationType(org.id));
				if (orgType !== 'school' || newRole === 'member') return;
				if (!(await hasClassroomCreationGrant(member.userId))) {
					throw new APIError('FORBIDDEN', {
						message: 'Classroom teachers need classroom creation access.'
					});
				}
			},
			afterAddMember: async ({ organization: org, member }) => {
				const orgType = parseOrgType(org.orgType);
				if (orgType !== 'school' && orgType !== 'group') return;
				const db = getNeonDatabase();
				const now = new Date();
				if (orgType === 'school') {
					await db.insert(classroomEnrollmentHistory).values({
						id: crypto.randomUUID(),
						organizationId: org.id,
						userId: member.userId,
						role: member.role,
						joinedAt: now
					});
				}
				if (orgType === 'group') {
					await db
						.insert(organizationActivityPreferences)
						.values({
							organizationId: org.id,
							userId: member.userId,
							enabled: false,
							createdAt: now,
							updatedAt: now
						})
						.onConflictDoNothing();
				}
			},
			afterUpdateMemberRole: async ({ organization: org, member }) => {
				if (parseOrgType(org.orgType) !== 'school') return;
				await getNeonDatabase()
					.update(classroomEnrollmentHistory)
					.set({ role: member.role })
					.where(
						and(
							eq(classroomEnrollmentHistory.organizationId, org.id),
							eq(classroomEnrollmentHistory.userId, member.userId),
							isNull(classroomEnrollmentHistory.leftAt)
						)
					);
			},
			afterRemoveMember: async ({ organization: org, member }) => {
				const orgType = parseOrgType(org.orgType);
				if (orgType !== 'school' && orgType !== 'group') return;
				const db = getNeonDatabase();
				await db
					.update(classroomEnrollmentHistory)
					.set({ leftAt: new Date() })
					.where(
						and(
							eq(classroomEnrollmentHistory.organizationId, org.id),
							eq(classroomEnrollmentHistory.userId, member.userId),
							isNull(classroomEnrollmentHistory.leftAt)
						)
					);
				if (orgType === 'group') {
					await db
						.delete(organizationActivityPreferences)
						.where(
							and(
								eq(organizationActivityPreferences.organizationId, org.id),
								eq(organizationActivityPreferences.userId, member.userId)
							)
						);
					await db.delete(practiceActivityAudiences).where(
						and(
							eq(practiceActivityAudiences.organizationId, org.id),
							sql`${practiceActivityAudiences.eventId} IN (
									SELECT ${practiceActivityEvents.id}
									FROM ${practiceActivityEvents}
									WHERE ${practiceActivityEvents.userId} = ${member.userId}
								)`
						)
					);
				}
			}
		}
	});
}
