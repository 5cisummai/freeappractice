import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTutorProfileView: vi.fn()
}));

vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView
}));

import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';

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
	});

	it('memoizes the promise and shares one profile read within a request', async () => {
		const locals = {} as App.Locals;

		const first = getTutorProfileViewForRequest(locals, 'user-1');
		const second = getTutorProfileViewForRequest(locals, 'user-1');

		expect(second).toBe(first);
		expect(mocks.getTutorProfileView).toHaveBeenCalledTimes(1);
		expect(await first).toMatchObject({ ageConfirmedAt: null });
		expect(locals.tutorProfileView).toBe(first);
	});

	it('does not share a value between request locals', async () => {
		const firstLocals = {} as App.Locals;
		const secondLocals = {} as App.Locals;

		await getTutorProfileViewForRequest(firstLocals, 'user-1');
		await getTutorProfileViewForRequest(secondLocals, 'user-1');

		expect(mocks.getTutorProfileView).toHaveBeenCalledTimes(2);
	});
});
