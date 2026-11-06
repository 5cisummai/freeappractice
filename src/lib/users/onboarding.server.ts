import { ONBOARDING_GOALS, type OnboardingGoal } from '#lib/onboarding.js';
import { selectValidCourses } from '#lib/users/course-selection.js';
import { updateUserCourses } from '#lib/users/model.server.js';

export async function completeOnboarding(
	userId: string,
	input: { courses: unknown[]; goals: unknown[] }
) {
	const courses = selectValidCourses(input.courses);
	if (!courses) return { ok: false, error: 'Choose at least one course to continue.' } as const;
	const goals = input.goals.filter(
		(goal): goal is OnboardingGoal =>
			typeof goal === 'string' && (ONBOARDING_GOALS as readonly string[]).includes(goal)
	);
	if (!goals.length) return { ok: false, error: 'Choose at least one goal to continue.' } as const;
	await updateUserCourses(userId, courses);
	return { ok: true, courses, state: { status: 'complete', goals } } as const;
}
