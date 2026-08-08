import { getNeonDatabase, type NeonDatabase } from '$lib/server/neon/db';

/**
 * Compatibility seam for modules that still call `connectDb()`.
 * Returns the Neon HTTP database.
 */
export async function connectDb(): Promise<NeonDatabase> {
	return getNeonDatabase();
}
