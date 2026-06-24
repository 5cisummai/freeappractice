import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.DATABASE_URI;
if (!uri) throw new Error('DATABASE_URI is required');

function getDbName(input: string): string {
	const url = new URL(input);
	const name = url.pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
}

const client = new MongoClient(uri);
const dbName = getDbName(uri);

async function main() {
	await client.connect();
	const db = client.db(dbName);

	await Promise.all([
		db.collection('authUsers').createIndex({ email: 1 }, { unique: true, name: 'email_unique' }),
		db.collection('authSessions').createIndex({ token: 1 }, { unique: true, name: 'token_unique' }),
		db.collection('authSessions').createIndex({ userId: 1 }, { name: 'userId_idx' }),
		db
			.collection('authSessions')
			.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' }),
		db.collection('authAccounts').createIndex({ userId: 1 }, { name: 'userId_idx' }),
		db
			.collection('authAccounts')
			.createIndex(
				{ providerId: 1, accountId: 1 },
				{ unique: true, name: 'provider_account_unique' }
			),
		db.collection('authVerifications').createIndex({ identifier: 1 }, { name: 'identifier_idx' })
	]);

	console.log('Better Auth indexes created.');
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.close();
	});
