import { timingSafeEqual } from 'node:crypto';

/** Unverified accounts older than this are eligible for deletion. */
export const UNVERIFIED_USER_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function isAuthorizedCronRequest(
	request: Request,
	cronSecret: string | undefined
): boolean {
	if (!cronSecret) return false;
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return false;

	const token = header.slice('Bearer '.length);
	const expected = Buffer.from(cronSecret);
	const actual = Buffer.from(token);
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}

export function unverifiedUserCutoff(now = new Date()): Date {
	return new Date(now.getTime() - UNVERIFIED_USER_MAX_AGE_MS);
}
