import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	findOrganizationByShareToken,
	listUserOrganizations,
	getOrganizationTypeForUser,
	listClassroomReport,
	addMember,
	setActiveOrganization
} = vi.hoisted(() => ({
	findOrganizationByShareToken: vi.fn(),
	listUserOrganizations: vi.fn(),
	getOrganizationTypeForUser: vi.fn(),
	listClassroomReport: vi.fn(),
	addMember: vi.fn(),
	setActiveOrganization: vi.fn()
}));
vi.mock('#lib/auth/organization-queries.server.js', () => ({
	findOrganizationByShareToken,
	listUserOrganizations,
	getOrganizationTypeForUser,
	listClassroomReport
}));
vi.mock('#lib/auth/server.js', () => ({ auth: { api: { addMember, setActiveOrganization } } }));

import { joinOrganization } from '#lib/auth/join-organization.server.js';
import { getClassroomReport, getStudentReportDetail } from '#lib/auth/student-report.server.js';

beforeEach(() => vi.resetAllMocks());

describe('joinOrganization', () => {
	it('rejects invalid or non-group invites', async () => {
		findOrganizationByShareToken.mockResolvedValue({ id: 'org', orgType: 'school' });
		expect(await joinOrganization('token', 'user', new Headers())).toEqual({
			error: 'That invite link is invalid or expired.',
			reason: 'invalid_invite'
		});
		expect(addMember).not.toHaveBeenCalled();
	});
	it.each([true, false])(
		'activates the organization when alreadyMember is %s',
		async (alreadyMember) => {
			findOrganizationByShareToken.mockResolvedValue({ id: 'org', orgType: 'group' });
			listUserOrganizations.mockResolvedValue(alreadyMember ? [{ id: 'org' }] : []);
			const headers = new Headers({ cookie: 'session=1' });
			expect(await joinOrganization('token', 'user', headers)).toEqual({
				organizationId: 'org',
				alreadyMember
			});
			expect(addMember).toHaveBeenCalledTimes(alreadyMember ? 0 : 1);
			if (!alreadyMember)
				expect(addMember).toHaveBeenCalledWith({
					body: { userId: 'user', role: 'member', organizationId: 'org' }
				});
			expect(setActiveOrganization).toHaveBeenCalledWith({
				body: { organizationId: 'org' },
				headers
			});
		}
	);
});

describe('getStudentReportDetail', () => {
	it('authorizes summary access before loading the requested report', async () => {
		getOrganizationTypeForUser.mockResolvedValue('school');
		listUserOrganizations.mockResolvedValue([{ id: 'org', role: 'admin' }]);
		listClassroomReport.mockResolvedValue({ rows: [], total: 0, page: 2, limit: 10 });
		expect(await getClassroomReport('teacher', 'org', { page: 2, limit: 10 })).toEqual({
			data: { rows: [], total: 0, page: 2, limit: 10 }
		});
		expect(listClassroomReport).toHaveBeenCalledWith('org', { page: 2, limit: 10 });
	});
	it('requires school membership and a teacher role', async () => {
		getOrganizationTypeForUser.mockResolvedValueOnce('group').mockResolvedValueOnce('school');
		listUserOrganizations.mockResolvedValue([{ id: 'org', role: 'member' }]);
		expect(await getStudentReportDetail('org', 'teacher', 'student')).toEqual({
			error: 'Classroom membership is required.',
			reason: 'membership'
		});
		expect(await getStudentReportDetail('org', 'teacher', 'student')).toEqual({
			error: 'Teacher access is required.',
			reason: 'teacher'
		});
	});
});
