import { getNeonDatabase } from '#lib/server/neon/db.js';
import { apArtHistoryApiHistory } from '#lib/server/neon/schema/ap-art-history.js';
import { logger } from '#lib/server/logger.js';

export type ApArtHistoryApiHistoryInput = {
	method: string;
	path: string;
	query: string | null;
	workNumber?: number;
	userId?: string | null;
	statusCode: number;
	durationMs: number;
};

export async function recordApArtHistoryApiRequest(input: ApArtHistoryApiHistoryInput): Promise<void> {
	const db = getNeonDatabase();
	const at = new Date();
	await db.insert(apArtHistoryApiHistory).values({
		id: crypto.randomUUID(),
		at,
		method: input.method,
		path: input.path,
		query: input.query,
		workNumber: input.workNumber ?? null,
		userId: input.userId ?? null,
		statusCode: input.statusCode,
		durationMs: input.durationMs
	});
}

export function recordApArtHistoryApiRequestBestEffort(input: ApArtHistoryApiHistoryInput): void {
	void recordApArtHistoryApiRequest(input).catch((error) => {
		logger.warn('Failed to record AP Art History API history', { error, path: input.path });
	});
}
