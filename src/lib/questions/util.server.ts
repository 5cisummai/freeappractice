import { createHash } from 'node:crypto';

/** Check if a Neon/PostgreSQL write hit a unique constraint. */
export function isDuplicateKeyError(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const code = (err as { code?: number | string }).code;
	return code === 11000 || code === '23505';
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
