import type { Cookies } from '@sveltejs/kit';
import { isFrqPracticeEnabled } from '$lib/flags';
import { getUserDashboardProfileOrFail } from '$lib/users/profile.server';
import { getDashboardProgress, getDashboardStats } from '$lib/users/dashboard-queries.server';
import { timezoneFromCookies } from '$lib/users/timezone';
import { ONBOARDING_COOKIE_NAME, readOnboardingState } from '$lib/onboarding.js';
import { updateUserSubjects } from '$lib/users/model.server';

export async function loadUserDashboardData(userId: string, cookies: Cookies) {
	const frqEnabled = await isFrqPracticeEnabled();
	const user = await getUserDashboardProfileOrFail(userId);
	const profileSubjects = user.subjects ?? [];
	const legacySubjects = readOnboardingState(cookies.get(ONBOARDING_COOKIE_NAME)).subjects;
	const selectedSubjects = profileSubjects.length > 0 ? profileSubjects : legacySubjects;

	if (profileSubjects.length === 0 && legacySubjects.length > 0) {
		await updateUserSubjects(userId, legacySubjects);
	}

	return {
		stats: await getDashboardStats(
			userId,
			user.createdAt,
			timezoneFromCookies(cookies),
			frqEnabled
		),
		progress: await getDashboardProgress(userId, user.progress, frqEnabled),
		frqEnabled,
		selectedSubjects
	};
}
