import mongoose from 'mongoose';
import { DATABASE_URI } from '$env/static/private';

// Cached connection for serverless environments (Vercel/Cloudflare edge)
let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = {
	conn: null,
	promise: null
};

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
				// Handle unexpected disconnects
				mongoose.connection.on('error', (err) => {
					console.error('MongoDB connection error:', err);
					cached.conn = null;
					cached.promise = null;
				});

				mongoose.connection.on('disconnected', () => {
					console.warn('MongoDB disconnected. Reconnecting...');
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
