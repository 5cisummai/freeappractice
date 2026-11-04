import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	listUserOrganizations: vi.fn(),
	listOrganizationMembers: vi.fn(),
	listOrganizationActivity: vi.fn(),
	listOrganizationLeaderboard: vi.fn(),
	listOrganizationSharedSets: vi.fn()
}));
vi.mock('#lib/auth/organization-queries.server.js', () => mocks);

import {
	getGroupMembers,
	getGroupMaterials,
	getGroupOverview
} from '../../../src/lib/auth/group-views.server';
import { OrganizationPermissionError } from '../../../src/lib/auth/organization-types';

describe('shared study group views', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it.each(['missing', 'school'])(
		'rejects %s membership before reading group data',
		async (orgType) => {
			mocks.listUserOrganizations.mockResolvedValue(
				orgType === 'missing' ? [] : [{ id: 'group-1', orgType, role: 'admin' }]
			);
			await expect(getGroupMembers('user-1', 'group-1')).rejects.toBeInstanceOf(
				OrganizationPermissionError
			);
			await expect(getGroupMaterials('user-1', 'group-1')).rejects.toBeInstanceOf(
				OrganizationPermissionError
			);
			await expect(getGroupOverview('user-1', 'group-1', 'UTC')).rejects.toBeInstanceOf(
				OrganizationPermissionError
			);
			expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
			expect(mocks.listOrganizationSharedSets).not.toHaveBeenCalled();
			expect(mocks.listOrganizationActivity).not.toHaveBeenCalled();
			expect(mocks.listOrganizationLeaderboard).not.toHaveBeenCalled();
		}
	);

	it.each(['member', 'admin', 'owner'])(
		'applies %s email visibility to member views',
		async (role) => {
			mocks.listUserOrganizations.mockResolvedValue([{ id: 'group-1', orgType: 'group', role }]);
			mocks.listOrganizationMembers.mockResolvedValue([
				{ userId: 'other', email: 'other@example.com' }
			]);
			expect(await getGroupMembers('user-1', 'group-1')).toEqual([
				{ userId: 'other', email: role === 'member' ? null : 'other@example.com' }
			]);
		}
	);

	it('uses the requested timezone for the shared overview and preserves material management rights', async () => {
		mocks.listUserOrganizations.mockResolvedValue([
			{ id: 'group-1', orgType: 'group', role: 'member' }
		]);
		mocks.listOrganizationActivity.mockResolvedValue([{ id: 'activity' }]);
		mocks.listOrganizationSharedSets.mockResolvedValue([{ id: 'set' }]);
		mocks.listOrganizationLeaderboard.mockResolvedValue([{ userId: 'user-1' }]);
		expect(await getGroupOverview('user-1', 'group-1', 'America/Los_Angeles')).toEqual({
			orgActivity: [{ id: 'activity' }],
			orgSharedSets: [{ id: 'set' }],
			orgLeaderboard: [{ userId: 'user-1' }]
		});
		expect(mocks.listOrganizationLeaderboard).toHaveBeenCalledWith(
			'group-1',
			'America/Los_Angeles'
		);
		expect(await getGroupMaterials('user-1', 'group-1')).toEqual({
			materials: [{ id: 'set' }],
			canManageMaterials: false
		});
	});
});
