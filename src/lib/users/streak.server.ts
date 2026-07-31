import type { Cookies } from '@sveltejs/kit';
import { getFrqActivityForUser } from '$lib/frq/attempts.server';
import { isFrqPracticeEnabled } from '$lib/flags';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { calcStreak } from '$lib/users/stats.server';
import { timezoneFromCookies } from '$lib/users/timezone';

/** Lightweight streak for the app sidebar (avoids full stats aggregation). */
export async function loadUserStreak(userId: string, cookies: Cookies): Promise<number> {
	const frqEnabled = await isFrqPracticeEnabled();
	const [user, frqActivity] = await Promise.all([
		findUserProfileOrFail(userId, 'questionHistory'),
		frqEnabled ? getFrqActivityForUser(userId) : Promise.resolve([])
	]);
	const history = user.questionHistory ?? [];
	return calcStreak([...history, ...frqActivity], timezoneFromCookies(cookies));
}
