import { describe, expect, it } from 'vitest';
import {
	isShareToken,
	orgSharesUserProgress,
	orgUsesUserSuper,
	parseOrgType,
	personalOrgName,
	personalOrgSlug,
	slugifyOrgName
} from '$lib/auth/organization-types';
import { safeAppPath } from '$lib/auth/app-path';

describe('organization types', () => {
	it('parses known org types and rejects others', () => {
		expect(parseOrgType('personal')).toBe('personal');
		expect(parseOrgType('group')).toBe('group');
		expect(parseOrgType('school')).toBe('school');
		expect(parseOrgType('classroom')).toBeNull();
	});

	it('shares progress and Super for personal and group only', () => {
		expect(orgSharesUserProgress('personal')).toBe(true);
		expect(orgSharesUserProgress('group')).toBe(true);
		expect(orgSharesUserProgress('school')).toBe(false);
		expect(orgSharesUserProgress('enterprise')).toBe(false);
		expect(orgUsesUserSuper('group')).toBe(true);
		expect(orgUsesUserSuper('enterprise')).toBe(false);
	});

	it('builds personal org slugs and names', () => {
		expect(personalOrgSlug('User_123')).toBe('u-user123');
		expect(personalOrgName('Ada Lovelace')).toBe("Ada's Space");
	});

	it('slugifies group names with a suffix', () => {
		expect(slugifyOrgName('AP Bio Squad!', 'ab12')).toBe('ap-bio-squad-ab12');
	});

	it('detects share tokens', () => {
		expect(isShareToken('join_abc')).toBe(true);
		expect(isShareToken('inv_abc')).toBe(false);
		expect(isShareToken('join_')).toBe(false);
	});
});

describe('safeAppPath', () => {
	it('allows app paths and rejects open redirects', () => {
		expect(safeAppPath('/app/invite/join_x')).toBe('/app/invite/join_x');
		expect(safeAppPath('https://evil.example')).toBe('/app');
		expect(safeAppPath('//evil.example')).toBe('/app');
		expect(safeAppPath('/login')).toBe('/app');
	});
});
