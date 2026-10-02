export const COACH_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const COACH_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const COACH_IMAGE_MAX_DIMENSION = 8192;
export const COACH_IMAGE_MAX_PIXELS = 16_000_000;

export function coachImageUrl(id: string): string {
	return `/api/coach/images/${id}`;
}

export function coachImageId(url: unknown): string | null {
	if (typeof url !== 'string') return null;
	return /^\/api\/coach\/images\/([0-9a-f-]{36})$/.exec(url)?.[1] ?? null;
}
