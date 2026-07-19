import { connectDb } from '$lib/server/db';
import { deleteAppDataDocuments } from '$lib/users/delete-app-data-documents.server';

/**
 * Deletes app-owned rows for one or more users (profile, FRQ attempts, referrals).
 * Auth collections (sessions/accounts/verifications) are cleaned by Better Auth on account delete.
 */
export async function deleteAppDataForUsers(userIds: string | string[]): Promise<void> {
	const ids = Array.isArray(userIds) ? userIds : [userIds];
	if (ids.length === 0) return;

	await connectDb();
	await deleteAppDataDocuments(ids);
}
