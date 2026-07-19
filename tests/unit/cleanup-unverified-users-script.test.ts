import { describe, expect, it } from 'vitest';
import {
	assertSafeEmail,
	assertSafeUserId,
	isEligibleUnverifiedUser,
	unverifiedStaleFilter
} from '../../scripts/cleanup-unverified-users-lib';

describe('assertSafeUserId / assertSafeEmail', () => {
	it('accepts plain ids and emails', () => {
		expect(assertSafeUserId('699720205302573b1e7bf8e6')).toBe('699720205302573b1e7bf8e6');
		expect(assertSafeEmail('user@example.com')).toBe('user@example.com');
	});

	it('rejects operator-like payloads', () => {
		expect(() => assertSafeUserId({ $gt: '' })).toThrow(/invalid user id/);
		expect(() => assertSafeEmail({ $ne: null })).toThrow(/email must be a string/);
		expect(() => assertSafeEmail('not-an-email')).toThrow(/invalid email/);
	});
});

describe('isEligibleUnverifiedUser', () => {
	const cutoff = new Date('2026-07-15T00:00:00.000Z');

	it('rejects verified users even if older than cutoff', () => {
		expect(
			isEligibleUnverifiedUser(
				{ emailVerified: true, createdAt: new Date('2026-01-01T00:00:00.000Z') },
				cutoff
			)
		).toBe(false);
	});

	it('rejects unverified users newer than cutoff', () => {
		expect(
			isEligibleUnverifiedUser(
				{ emailVerified: false, createdAt: new Date('2026-07-16T00:00:00.000Z') },
				cutoff
			)
		).toBe(false);
	});

	it('rejects users missing createdAt', () => {
		expect(isEligibleUnverifiedUser({ emailVerified: false, createdAt: null }, cutoff)).toBe(false);
	});

	it('accepts unverified users older than cutoff', () => {
		expect(
			isEligibleUnverifiedUser(
				{ emailVerified: false, createdAt: new Date('2026-07-14T23:59:59.000Z') },
				cutoff
			)
		).toBe(true);
	});

	it('rejects users with missing emailVerified (must be explicitly false)', () => {
		expect(
			isEligibleUnverifiedUser(
				{ emailVerified: undefined, createdAt: new Date('2026-01-01T00:00:00.000Z') },
				cutoff
			)
		).toBe(false);
	});
});

describe('unverifiedStaleFilter', () => {
	it('requires emailVerified false and createdAt before cutoff', () => {
		const cutoff = new Date('2026-07-15T00:00:00.000Z');
		expect(unverifiedStaleFilter(cutoff)).toEqual({
			emailVerified: false,
			createdAt: { $lt: cutoff }
		});
	});
});
