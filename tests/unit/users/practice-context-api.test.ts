import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getOrganizationTypeForUser: vi.fn(),
	isClassroomPracticeEnabled: vi.fn()
}));

vi.mock('#lib/auth/organization-queries.server.js', () => ({
	getOrganizationTypeForUser: mocks.getOrganizationTypeForUser
}));
vi.mock('#lib/flags.js', () => ({
	isClassroomPracticeEnabled: mocks.isClassroomPracticeEnabled
}));

import {
	resolveApiPracticeContext,
	resolvePracticeContext
} from '#lib/users/practice-context.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

describe('resolveApiPracticeContext', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isClassroomPracticeEnabled.mockResolvedValue(true);
	});

	it('forces the personal namespace when practiceNamespace=personal', async () => {
		const context = await resolveApiPracticeContext(
			{
				url: new URL('https://example.com/api/me/stats?practiceNamespace=personal'),
				locals: { session: { activeOrganizationId: 'school-org' } as App.Locals['session'] }
			},
			'user-1'
		);
		expect(context).toEqual({ organizationId: null });
		expect(mocks.getOrganizationTypeForUser).not.toHaveBeenCalled();
	});

	it('uses the session active organization by default', async () => {
		mocks.getOrganizationTypeForUser.mockResolvedValue('school');
		const context = await resolveApiPracticeContext(
			{
				url: new URL('https://example.com/api/me/stats'),
				locals: { session: { activeOrganizationId: 'school-org' } as App.Locals['session'] }
			},
			'user-1'
		);
		expect(context).toEqual({ organizationId: 'school-org' });
	});

	it('rejects an invalid practiceNamespace value', async () => {
		await expect(
			resolveApiPracticeContext(
				{
					url: new URL('https://example.com/api/me/stats?practiceNamespace=classroom'),
					locals: { session: undefined }
				},
				'user-1'
			)
		).rejects.toBeInstanceOf(OrganizationPermissionError);
	});

	it('keeps personal and group organizations in the personal namespace', async () => {
		mocks.getOrganizationTypeForUser.mockResolvedValueOnce('personal');
		await expect(resolvePracticeContext('user-1', 'personal-org')).resolves.toEqual({
			organizationId: null
		});
		mocks.getOrganizationTypeForUser.mockResolvedValueOnce('group');
		await expect(resolvePracticeContext('user-1', 'group-org')).resolves.toEqual({
			organizationId: null
		});
	});
});
