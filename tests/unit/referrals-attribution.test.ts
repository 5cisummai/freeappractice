import { describe, expect, it } from 'vitest';
import {
	canAttributeReferral,
	isValidReferralCodeShape,
	normalizeReferralCode,
	parseReferralAttribution,
	shouldActivateOnClaim
} from '$lib/referrals/attribution';

describe('normalizeReferralCode', () => {
	it('trims whitespace', () => {
		expect(normalizeReferralCode('  abc123  ')).toBe('abc123');
	});
});

describe('isValidReferralCodeShape', () => {
	it('rejects empty and oversized codes', () => {
		expect(isValidReferralCodeShape('')).toBe(false);
		expect(isValidReferralCodeShape('   ')).toBe(false);
		expect(isValidReferralCodeShape('a'.repeat(65))).toBe(false);
		expect(isValidReferralCodeShape('valid-code')).toBe(true);
	});
});

describe('parseReferralAttribution', () => {
	it('parses a valid cookie payload', () => {
		expect(parseReferralAttribution(JSON.stringify({ code: 'abc', capturedAt: 100 }))).toEqual({
			code: 'abc',
			capturedAt: 100
		});
	});

	it('rejects malformed payloads', () => {
		expect(parseReferralAttribution('not-json')).toBeNull();
		expect(parseReferralAttribution(JSON.stringify({ code: 1, capturedAt: 100 }))).toBeNull();
		expect(parseReferralAttribution(JSON.stringify({ code: 'abc', capturedAt: 'x' }))).toBeNull();
	});
});

describe('canAttributeReferral', () => {
	it('blocks self-referral and pre-existing accounts', () => {
		expect(
			canAttributeReferral({
				referrerUserId: 'a',
				referredUserId: 'a',
				profileCreatedAtMs: 200,
				capturedAtMs: 100
			})
		).toBe(false);

		expect(
			canAttributeReferral({
				referrerUserId: 'a',
				referredUserId: 'b',
				profileCreatedAtMs: 50,
				capturedAtMs: 100
			})
		).toBe(false);
	});

	it('allows new accounts created after the invite', () => {
		expect(
			canAttributeReferral({
				referrerUserId: 'a',
				referredUserId: 'b',
				profileCreatedAtMs: 200,
				capturedAtMs: 100
			})
		).toBe(true);
	});
});

describe('shouldActivateOnClaim', () => {
	it('activates when the referred user already practiced', () => {
		expect(shouldActivateOnClaim(0)).toBe(false);
		expect(shouldActivateOnClaim(1)).toBe(true);
	});
});
