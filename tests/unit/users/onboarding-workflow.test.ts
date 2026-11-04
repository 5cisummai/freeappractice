import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCourses } from '#lib/catalog/courses.js';
const mocks = vi.hoisted(() => ({ updateUserCourses: vi.fn() }));
vi.mock('#lib/users/model.server.js', () => mocks);
import { completeOnboarding } from '#lib/users/onboarding.server.js';

describe('shared onboarding completion', () => {
	beforeEach(() => vi.clearAllMocks());
	it.each([
		{ courses: [], goals: ['exam_prep'] },
		{ courses: [getCourses()[0]!.name], goals: ['invalid'] }
	])('does not save courses when required selections are missing', async (input) => {
		expect(await completeOnboarding('user-1', input)).toMatchObject({ ok: false });
		expect(mocks.updateUserCourses).not.toHaveBeenCalled();
	});
	it('preserves form filtering behavior and returns the completion state after saving', async () => {
		const course = getCourses()[0]!.name;
		expect(
			await completeOnboarding('user-1', {
				courses: ['invalid', course, course],
				goals: ['invalid', 'exam_prep']
			})
		).toEqual({ ok: true, courses: [course], state: { status: 'complete', goals: ['exam_prep'] } });
		expect(mocks.updateUserCourses).toHaveBeenCalledWith('user-1', [course]);
	});
});
