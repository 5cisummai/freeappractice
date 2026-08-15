import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('migrated-account deletion migration', () => {
	it('allows migration-map rows to be removed with their auth user', () => {
		const migration = readFileSync('drizzle/0013_fix_migration_delete_fk.sql', 'utf8');

		expect(migration).toContain(
			'DROP CONSTRAINT "better_auth_migration_map_better_auth_user_id_users_id_fk"'
		);
		expect(migration).toContain(
			'FOREIGN KEY ("better_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade'
		);
	});
});
