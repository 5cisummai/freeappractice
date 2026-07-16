import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicEnv = vi.hoisted(() => ({
	PUBLIC_BASE_URL: undefined as string | undefined
}));

const appEnv = vi.hoisted(() => ({
	dev: false
}));

vi.mock('$env/dynamic/public', () => ({
	env: publicEnv
}));

vi.mock('$app/environment', () => ({
	get dev() {
		return appEnv.dev;
	}
}));

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

import { PRODUCTION_SITE_URL, authCallbackUrl, getSiteUrl } from '$lib/auth/urls';

describe('getSiteUrl', () => {
	beforeEach(() => {
		publicEnv.PUBLIC_BASE_URL = undefined;
		appEnv.dev = false;
	});

	it('uses PUBLIC_BASE_URL when configured', () => {
		publicEnv.PUBLIC_BASE_URL = 'https://staging.example.com/';
		expect(getSiteUrl()).toBe('https://staging.example.com');
	});

	it('uses request origin in development', () => {
		appEnv.dev = true;
		expect(getSiteUrl('http://localhost:5173/')).toBe('http://localhost:5173');
		expect(getSiteUrl()).toBe('http://localhost:5173');
	});

	it('falls back to production URL outside development', () => {
		expect(getSiteUrl('http://ignored.example')).toBe(PRODUCTION_SITE_URL);
	});
});

describe('authCallbackUrl', () => {
	beforeEach(() => {
		publicEnv.PUBLIC_BASE_URL = 'https://example.com';
		appEnv.dev = false;
	});

	it('builds absolute callback URLs', () => {
		expect(authCallbackUrl('/app')).toBe('https://example.com/app');
		expect(authCallbackUrl('/login')).toBe('https://example.com/login');
	});
});
