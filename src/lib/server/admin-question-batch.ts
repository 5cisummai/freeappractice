import { timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

const HEADER = 'x-questions-admin-secret';

/**
 * Validates the admin secret from the request header against QUESTIONS_S3_ADMIN_SECRET.
 * Uses timing-safe comparison; returns false if the env var is unset.
 */
export function verifyQuestionsAdminSecret(request: Request): boolean {
	const expected = env.QUESTIONS_S3_ADMIN_SECRET;
	if (!expected) return false;

	const provided = request.headers.get(HEADER);
	if (!provided) return false;

	const a = Buffer.from(provided, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}
