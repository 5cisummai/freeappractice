import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTutorProfileView: vi.fn(),
	getAgeConfirmedAt: vi.fn()
}));

vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView,
	getAgeConfirmedAt: mocks.getAgeConfirmedAt
}));

import {
	getAgeConfirmedAtForRequest,
	getTutorProfileViewForRequest
} from '$lib/super/feature-access.server';

describe('request-local tutor profile cache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getTutorProfileView.mockResolvedValue({
			ageConfirmedAt: null,
			selectedApClasses: [],
			targetDates: [],
			studyAvailability: '',
			teachingStyle: 'socratic',
			memoryEnabled: false,
			memoryDisclosureSeenAt: null
		});
		mocks.getAgeConfirmedAt.mockResolvedValue(new Date('2026-01-01T00:00:00.000Z'));
	});

	it('memoizes the promise and shares one profile read within a request', async () => {
		const locals = {} as App.Locals;

		const first = getTutorProfileViewForRequest(locals, 'user-1');
		const second = getTutorProfileViewForRequest(locals, 'user-1');

		expect(second).toBe(first);
		expect(await first).toMatchObject({ ageConfirmedAt: null });
		expect(mocks.getTutorProfileView).toHaveBeenCalledTimes(1);
		expect(locals.tutorProfileView).toBe(first);
	});

	it('does not share a value between request locals', async () => {
		const firstLocals = {} as App.Locals;
		const secondLocals = {} as App.Locals;

		await getTutorProfileViewForRequest(firstLocals, 'user-1');
		await getTutorProfileViewForRequest(secondLocals, 'user-1');

		expect(mocks.getTutorProfileView).toHaveBeenCalledTimes(2);
	});

	it('memoizes the narrow age read without loading profile relations', async () => {
		const locals = {} as App.Locals;
		const first = getAgeConfirmedAtForRequest(locals, 'user-1');
		const second = getAgeConfirmedAtForRequest(locals, 'user-1');

		expect(second).toBe(first);
		expect(await first).toEqual(new Date('2026-01-01T00:00:00.000Z'));
		expect(mocks.getAgeConfirmedAt).toHaveBeenCalledTimes(1);
		expect(mocks.getTutorProfileView).not.toHaveBeenCalled();
	});

	it('derives the age result from an existing full-profile request', async () => {
		const locals = {} as App.Locals;
		mocks.getTutorProfileView.mockResolvedValueOnce({
			ageConfirmedAt: '2026-02-01T00:00:00.000Z',
			selectedApClasses: [],
			targetDates: [],
			studyAvailability: '',
			teachingStyle: 'socratic',
			memoryEnabled: false,
			memoryDisclosureSeenAt: null
		});
		void getTutorProfileViewForRequest(locals, 'user-1');

		expect(await getAgeConfirmedAtForRequest(locals, 'user-1')).toEqual(
			new Date('2026-02-01T00:00:00.000Z')
		);
		expect(mocks.getAgeConfirmedAt).not.toHaveBeenCalled();
	});

	it('does not overlay a narrow age read onto a later profile', async () => {
		const locals = {} as App.Locals;
		mocks.getAgeConfirmedAt.mockResolvedValueOnce(new Date('2026-03-01T00:00:00.000Z'));
		mocks.getTutorProfileView.mockResolvedValueOnce({
			ageConfirmedAt: null,
			selectedApClasses: [],
			targetDates: [],
			studyAvailability: '',
			teachingStyle: 'socratic',
			memoryEnabled: false,
			memoryDisclosureSeenAt: null
		});
		await getAgeConfirmedAtForRequest(locals, 'user-1');

		expect(await getTutorProfileViewForRequest(locals, 'user-1')).toMatchObject({
			ageConfirmedAt: null
		});
		expect(mocks.getAgeConfirmedAt).toHaveBeenCalledTimes(1);
		expect(mocks.getTutorProfileView).toHaveBeenCalledTimes(1);
	});
});
