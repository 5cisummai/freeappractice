import { describe, expect, it } from 'vitest';
import {
	isAnonymousMcqFetch,
	shouldSkipGlobalApiRateLimit,
	shouldSkipSessionLookup
} from '$lib/server/request-policy.server';

describe('request policy', () => {
	it('treats anonymous MCQ fetch as one hot path', () => {
		expect(isAnonymousMcqFetch('POST', '/api/question')).toBe(true);
		expect(shouldSkipSessionLookup('POST', '/api/question')).toBe(true);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/question')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/api/question')).toBe(false);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/question/feedback')).toBe(false);
	});

	it('skips session lookup for public marketing GET routes', () => {
		expect(shouldSkipSessionLookup('GET', '/')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/practice/ap-biology')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/blog')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/blog/ap-biology-tips')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/pricing')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/app')).toBe(false);
		expect(shouldSkipSessionLookup('GET', '/login')).toBe(false);
	});
});
