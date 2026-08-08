import { getNeonDatabase, type NeonDatabase } from '$lib/server/neon/db';

/**
 * Compatibility seam for modules that still call `connectDb()` while their
 * repository code is being moved to Drizzle. It now returns the Neon HTTP
 * database and never opens a MongoDB connection.
 */
export async function connectDb(): Promise<NeonDatabase> {
	return getNeonDatabase();
}
