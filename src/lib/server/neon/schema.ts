export * from './schema/auth';
export * from './schema/app';
export * from './schema/content';
export * from './schema/ops';

import {
	authAccounts,
	authAccountsRelations,
	authInvitations,
	authMembers,
	authOrganizations,
	authRateLimits,
	authSessions,
	authSessionsRelations,
	authSubscriptions,
	authUsers,
	authUsersRelations,
	authVerifications
} from './schema/auth';

export const betterAuthSchema = {
	authUsers,
	authSessions,
	authAccounts,
	authVerifications,
	authSubscriptions,
	authOrganizations,
	authMembers,
	authInvitations,
	rateLimit: authRateLimits,
	authUsersRelations,
	authSessionsRelations,
	authAccountsRelations
};
