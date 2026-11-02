import { COACH_TEXT_ACCEPT, COACH_TEXT_MAX_BYTES } from '#lib/agent/attachments/text.js';

export const COACH_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const COACH_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const COACH_IMAGE_MAX_DIMENSION = 8192;
export const COACH_IMAGE_MAX_PIXELS = 16_000_000;

export const COACH_ATTACHMENT_MAX_BYTES = Math.max(COACH_IMAGE_MAX_BYTES, COACH_TEXT_MAX_BYTES);
export const COACH_ATTACHMENT_ACCEPT = [...COACH_IMAGE_TYPES, COACH_TEXT_ACCEPT].join(',');

export function coachImageUrl(id: string): string {
	return `/api/coach/images/${id}`;
}

export function coachImageId(url: unknown): string | null {
	if (typeof url !== 'string') return null;
	return /^\/api\/coach\/images\/([0-9a-f-]{36})$/.exec(url)?.[1] ?? null;
}
