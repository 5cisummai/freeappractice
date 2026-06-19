import { MongoClient, type Db } from 'mongodb';
import { DATABASE_URI } from '$env/static/private';

declare global {
	// eslint-disable-next-line no-var
	var __fapMongoClientPromise: Promise<MongoClient> | undefined;
}

function getDbName(uri: string): string {
	const parsed = new URL(uri);
	const name = parsed.pathname.replace(/^\//, '');
	if (!name) {
		throw new Error('DATABASE_URI must include a database name');
	}
	return name;
}

export function getMongoClient(): Promise<MongoClient> {
	if (!globalThis.__fapMongoClientPromise) {
		const client = new MongoClient(DATABASE_URI);
		globalThis.__fapMongoClientPromise = client.connect();
	}
	return globalThis.__fapMongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
	const client = await getMongoClient();
	return client.db(getDbName(DATABASE_URI));
}
