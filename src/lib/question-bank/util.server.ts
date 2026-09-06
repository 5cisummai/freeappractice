import { createHash } from 'node:crypto';

/** Check if a Neon/PostgreSQL write hit a unique constraint. */
export function isDuplicateKeyError(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const e = err as { code?: number | string; cause?: unknown };
	if (e.code === '23505') return true;
	return e.cause !== undefined ? isDuplicateKeyError(e.cause) : false;
}

/** Fail before PostgreSQL JSONB persistence when generated content contains U+0000. */
export function assertNoNullCharacters(value: unknown, path = 'generated content'): void {
	if (typeof value === 'string') {
		if (value.includes('\u0000')) {
			throw new Error(`${path} contains an unsupported null character`);
		}
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => assertNoNullCharacters(entry, `${path}[${index}]`));
		return;
	}
	if (!value || typeof value !== 'object' || value instanceof Date) return;
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		assertNoNullCharacters(entry, `${path}.${key}`);
	}
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
