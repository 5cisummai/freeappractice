import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { insightReports } from '$lib/server/neon/schema';

export async function lockInsightReports(userId: string, lockedAt: Date): Promise<void> {
	await getNeonDatabase()
		.update(insightReports)
		.set({ lockedAt, updatedAt: lockedAt })
		.where(and(eq(insightReports.userId, userId), isNull(insightReports.lockedAt)));
}

export async function unlockInsightReports(userId: string): Promise<void> {
	await getNeonDatabase()
		.update(insightReports)
		.set({ lockedAt: null, updatedAt: new Date() })
		.where(and(eq(insightReports.userId, userId), isNotNull(insightReports.lockedAt)));
}
