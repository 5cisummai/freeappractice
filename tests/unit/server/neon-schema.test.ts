import { describe, expect, it } from 'vitest';
import {
	appSchema,
	authAccounts,
	authAccountsRelations,
	authRateLimits,
	authSchema,
	authSessions,
	authSessionsRelations,
	authSubscriptions,
	authUsers,
	authUsersRelations,
	authVerifications,
	betterAuthSchema,
	contentSchema,
	opsSchema,
	poolRefillStates,
	questionRegistry
} from '$lib/server/neon/schema';

describe('Neon Drizzle schema', () => {
	it('keeps all PostgreSQL domains and Better Auth relations available', () => {
		expect(authSchema).toBeDefined();
		expect(appSchema).toBeDefined();
		expect(contentSchema).toBeDefined();
		expect(opsSchema).toBeDefined();
		expect(betterAuthSchema).toEqual({
			authUsers,
			authSessions,
			authAccounts,
			authVerifications,
			authSubscriptions,
			rateLimit: authRateLimits,
			authUsersRelations,
			authSessionsRelations,
			authAccountsRelations
		});
	});

	it('exports domain tables directly from the barrel', () => {
		expect(questionRegistry).toBeDefined();
		expect(poolRefillStates).toBeDefined();
		expect(authUsers).toBeDefined();
	});
});
