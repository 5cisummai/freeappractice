import mongoose from 'mongoose';
import { DATABASE_URI } from '$env/static/private';
import { logger } from '$lib/server/logger';

type MongooseCache = {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
	__lmstudioMongoose?: MongooseCache;
};

// Cached connection for serverless (survives warm isolates via globalThis).
const cached: MongooseCache = globalForMongoose.__lmstudioMongoose ?? {
	conn: null,
	promise: null
};
globalForMongoose.__lmstudioMongoose = cached;

export async function connectDb(): Promise<typeof mongoose> {
	if (cached.conn) return cached.conn;

	if (!cached.promise) {
		cached.promise = mongoose
			.connect(DATABASE_URI, {
				bufferCommands: false,
				serverSelectionTimeoutMS: 5000,
				socketTimeoutMS: 45000,
				connectTimeoutMS: 10000,
				heartbeatFrequencyMS: 10000
			})
			.then((m) => {
				mongoose.connection.on('error', (err) => {
					logger.error('MongoDB connection error', { error: err });
					cached.conn = null;
					cached.promise = null;
				});

				mongoose.connection.on('disconnected', () => {
					logger.warn('MongoDB disconnected. Reconnecting...');
					cached.conn = null;
					cached.promise = null;
				});

				cached.conn = m;
				return m;
			});
	}

	cached.conn = await cached.promise;
	return cached.conn;
}
