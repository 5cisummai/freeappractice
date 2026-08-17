import { describe, expect, it } from 'vitest';
import {
	isAccountSurface,
	isAgeGateExempt,
	shouldSkipSessionLookup
} from '$lib/auth/account-surface.server';

describe('account surface routing', () => {
	it('limits the age gate to app pages and account APIs', () => {
		expect(isAccountSurface('/app')).toBe(true);
		expect(isAccountSurface('/app/settings')).toBe(true);
		expect(isAccountSurface('/api/me/history')).toBe(true);
		expect(isAccountSurface('/api/super/profile')).toBe(true);
		expect(isAccountSurface('/api/question/frq')).toBe(true);
		expect(isAccountSurface('/api/question/feedback')).toBe(true);
		expect(isAccountSurface('/api/orgs/invite-link')).toBe(true);
		expect(isAccountSurface('/api/shared-practice-sets')).toBe(true);

		expect(isAccountSurface('/practice/ap-biology')).toBe(false);
		expect(isAccountSurface('/api/question')).toBe(false);
		expect(isAccountSurface('/api/cron/question-pool')).toBe(false);
		expect(isAccountSurface('/api/admin/super/cleanup')).toBe(false);
		expect(isAccountSurface('/api/bug-report')).toBe(false);
	});

	it('keeps age confirmation and auth routes exempt', () => {
		expect(isAgeGateExempt('/api/auth/get-session')).toBe(true);
		expect(isAgeGateExempt('/api/super/confirm-age')).toBe(true);
		expect(isAgeGateExempt('/app/confirm-age')).toBe(true);
		expect(isAgeGateExempt('/app/confirm-age/details')).toBe(true);
		expect(isAgeGateExempt('/app/settings')).toBe(false);
	});

	it('preserves the public MCQ POST session lookup skip', () => {
		expect(shouldSkipSessionLookup('POST', '/api/question')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/api/question')).toBe(false);
		expect(shouldSkipSessionLookup('POST', '/api/question/feedback')).toBe(false);
	});
});
