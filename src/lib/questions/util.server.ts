import { createHash } from 'node:crypto';

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
