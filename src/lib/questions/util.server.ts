import { createHash } from 'node:crypto';
import { SeenQuestion } from '$lib/questions/seen.server';

/** Check if an error is a MongoDB duplicate-key error (E11000). */
export function isDuplicateKeyError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Normalize and hash text for deduplication (SHA-256). */
export function computeContentHash(text: string): string {
	return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

/** Normalize a unit string for cache/pool operations. */
export function normalizeUnit(unit?: string | null, fallback = ''): string {
	const trimmed = typeof unit === 'string' ? unit.trim() : '';
	return trimmed || fallback;
}

const MAX_SEEN_PER_BUCKET = 100;

/** Record that a user has seen a question (fire-and-forget). */
export async function recordSeenQuestion(
	userId: string,
	contentHash: string,
	apClass: string,
	unit: string,
	questionType: 'mcq'
): Promise<void> {
	try {
		await SeenQuestion.updateOne(
			{ userId, contentHash },
			{ $setOnInsert: { userId, contentHash, apClass, unit, questionType } },
			{ upsert: true }
		);

		const count = await SeenQuestion.countDocuments({ userId, apClass, unit, questionType });
		if (count > MAX_SEEN_PER_BUCKET) {
			const excess = count - MAX_SEEN_PER_BUCKET;
			const oldest = await SeenQuestion.find(
				{ userId, apClass, unit, questionType },
				{ _id: 1 },
				{ sort: { seenAt: 1 }, limit: excess }
			).lean();
			await SeenQuestion.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
		}
	} catch {
		// Non-critical — don't let history tracking affect the main request
	}
}
