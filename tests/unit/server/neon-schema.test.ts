import { describe, expect, it } from 'vitest';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/neon-http';
import {
	appSchema,
	authAccounts,
	authAccountsRelations,
	authInvitations,
	authInvitationsRelations,
	authMembers,
	authMembersRelations,
	authOrganizations,
	authOrganizationsRelations,
	authRateLimits,
	authSchema,
	authSessions,
	authSessionsRelations,
	authSubscriptions,
	authUsers,
	authUsersRelations,
	authVerifications,
	betterAuthSchema,
	bugReports,
	contentSchema,
	opsSchema,
	poolRefillStates,
	questionRegistry
} from '$lib/server/neon/schema';

const authAdapterOptions = {
	experimental: { joins: true },
	user: { modelName: 'authUsers' },
	account: { modelName: 'authAccounts' },
	session: { modelName: 'authSessions' },
	verification: { modelName: 'authVerifications' }
};

async function compileAdapterJoin(
	baseModel: 'user' | 'account' | 'session',
	joinModel: 'account' | 'user' | 'session'
) {
	const db = drizzle.mock({ schema: betterAuthSchema });
	const adapter = drizzleAdapter(db, {
		provider: 'pg',
		schema: betterAuthSchema,
		transaction: false
	})(authAdapterOptions);
	const queryModel =
		baseModel === 'user'
			? db.query.authUsers
			: baseModel === 'account'
				? db.query.authAccounts
				: db.query.authSessions;
	const originalFindFirst = queryModel.findFirst.bind(queryModel);
	let compiledQuery: ReturnType<ReturnType<typeof originalFindFirst>['toSQL']> | undefined;

	(queryModel.findFirst as typeof queryModel.findFirst) = ((config) => {
		compiledQuery = originalFindFirst(config).toSQL();
		return Promise.resolve(undefined) as never;
	}) as typeof queryModel.findFirst;

	await adapter.findOne({
		model: baseModel,
		where: [{ field: 'id', value: `${baseModel}-1` }],
		join: { [joinModel]: true }
	});

	return compiledQuery;
}

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
			authOrganizations,
			authMembers,
			authInvitations,
			rateLimit: authRateLimits,
			authUsersRelations,
			authSessionsRelations,
			authAccountsRelations,
			authOrganizationsRelations,
			authMembersRelations,
			authInvitationsRelations
		});
	});

	it('exports domain tables directly from the barrel', () => {
		expect(questionRegistry).toBeDefined();
		expect(bugReports).toBeDefined();
		expect(poolRefillStates).toBeDefined();
		expect(authUsers).toBeDefined();
	});

	it.each([
		['user', 'account'],
		['user', 'session'],
		['account', 'user'],
		['session', 'user']
	] as const)(
		'compiles Better Auth %s -> %s joins without database traffic',
		async (baseModel, joinModel) => {
			const compiledQuery = await compileAdapterJoin(baseModel, joinModel);

			expect(compiledQuery?.sql).toContain('select');
			expect(compiledQuery?.sql).toContain('join');
		}
	);
});
