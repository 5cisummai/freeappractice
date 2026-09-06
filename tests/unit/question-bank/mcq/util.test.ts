import { describe, expect, it } from 'vitest';
import {
	assertNoNullCharacters,
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit
} from '$lib/question-bank/util.server';

describe('normalizeUnit', () => {
	it('trims units and falls back when empty', () => {
		expect(normalizeUnit('  Unit 1  ')).toBe('Unit 1');
		expect(normalizeUnit('')).toBe('');
		expect(normalizeUnit(null, 'fallback')).toBe('fallback');
		expect(normalizeUnit(undefined, 'fallback')).toBe('fallback');
		expect(normalizeUnit('   ', 'fallback')).toBe('fallback');
	});
});

describe('computeContentHash', () => {
	it('normalizes whitespace and case before hashing', () => {
		expect(computeContentHash('Hello   World')).toBe(computeContentHash('  hello world  '));
		expect(computeContentHash('a')).not.toBe(computeContentHash('b'));
		expect(computeContentHash('stable')).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe('isDuplicateKeyError', () => {
	it('detects Postgres unique-violation errors', () => {
		expect(isDuplicateKeyError({ code: '23505' })).toBe(true);
		expect(isDuplicateKeyError({ cause: { code: '23505' } })).toBe(true);
		expect(isDuplicateKeyError({ code: 11000 })).toBe(false);
		expect(isDuplicateKeyError({ code: '23503' })).toBe(false);
		expect(isDuplicateKeyError(null)).toBe(false);
		expect(isDuplicateKeyError('nope')).toBe(false);
	});
});

describe('assertNoNullCharacters', () => {
	it('rejects nested strings containing U+0000 before JSONB persistence', () => {
		expect(() =>
			assertNoNullCharacters({ explanation: 'charge and $\u0000pi$ bonding' }, 'stimulus')
		).toThrow('stimulus.explanation contains an unsupported null character');
	});

	it('allows ordinary LaTeX backslashes', () => {
		expect(() =>
			assertNoNullCharacters({ explanation: String.raw`charge and $\pi$ bonding` })
		).not.toThrow();
	});
});
