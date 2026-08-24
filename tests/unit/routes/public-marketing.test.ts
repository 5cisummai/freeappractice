import { describe, expect, it } from 'vitest';
import {
	isGoogleOneTapRoute,
	matchesPublicMarketingPath
} from '$lib/routes/public-marketing';

describe('public marketing routes', () => {
	it('matches blog index and posts for session skip', () => {
		expect(matchesPublicMarketingPath('/blog')).toBe(true);
		expect(matchesPublicMarketingPath('/blog/ap-biology-tips')).toBe(true);
	});

	it('matches one-tap marketing surfaces and login', () => {
		expect(isGoogleOneTapRoute('/login')).toBe(true);
		expect(isGoogleOneTapRoute('/blog')).toBe(true);
		expect(isGoogleOneTapRoute('/practice/ap-biology')).toBe(true);
		expect(isGoogleOneTapRoute('/privacy')).toBe(false);
	});
});
