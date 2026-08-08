/** Pure helpers for unverified-user cleanup (safe to unit test). */

export type CleanupCandidate = {
	id: string;
	email: string;
	emailVerified: boolean | null | undefined;
	createdAt: Date;
};

const SAFE_USER_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const SAFE_EMAIL = /^[^\s@$]+@[^\s@$]+\.[^\s@$]+$/;

/** Reject anything that could be interpreted as a Mongo operator payload. */
export function assertSafeUserId(value: unknown): string {
	if (typeof value !== 'string' || !SAFE_USER_ID.test(value)) {
		throw new Error(`Safety abort: invalid user id ${String(value)}`);
	}
	return value;
}

export function assertSafeEmail(value: unknown): string {
	if (typeof value !== 'string') {
		throw new Error('Safety abort: email must be a string');
	}
	const email = value.trim();
	if (!SAFE_EMAIL.test(email) || email.includes('$')) {
		throw new Error(`Safety abort: invalid email ${email}`);
	}
	return email;
}

/** Only users with emailVerified === false older than the cutoff are eligible. */
export function isEligibleUnverifiedUser(
	user: {
		emailVerified?: boolean | null;
		createdAt?: Date | null;
	},
	cutoff: Date
): boolean {
	if (user.emailVerified !== false) return false;
	if (!(user.createdAt instanceof Date) || Number.isNaN(user.createdAt.getTime())) return false;
	return user.createdAt < cutoff;
}

/**
 * Mongo filter that can never match a verified account.
 * Uses exact `false` (not `$ne: true`) so missing/odd values are never deleted.
 */
export function unverifiedStaleFilter(cutoff: Date) {
	return {
		emailVerified: false as const,
		createdAt: { $lt: cutoff }
	};
}
