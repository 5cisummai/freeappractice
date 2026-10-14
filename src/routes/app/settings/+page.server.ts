import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCourses } from '#lib/catalog/courses.js';
import { isSuperFreeBetaEnabled } from '#lib/flags.js';
import {
	getPersonalizedUsage,
	getPersonalizedUsageWarning
} from '#lib/agent/usage/controls.server.js';
import { formatCreditsFromMilli } from '#lib/agent/usage/credits.js';
import { getSuperBillingView } from '#lib/billing/subscriptions.server.js';
import { getPlanAccessForRequest } from '#lib/agent/access.server.js';
import { hasPaidCapability, type SuperAccessReason } from '#lib/billing/types.js';
import { getTutorProfileViewForRequest } from '#lib/agent/access.server.js';
import { getUserCourses, updateUserCourses } from '#lib/users/model.server.js';

const validCourses = new Set(getCourses().map((course) => course.name));

type SettingsUsage =
	| {
			status: 'available';
			usedCredits: string;
			limitCredits: string;
			remainingCredits: string;
			warning: 80 | 95 | null;
	  }
	| { status: 'unavailable' }
	| { status: 'not_available' };

async function readSettingsUsage(
	userId: string,
	enabled: boolean,
	accessReason: SuperAccessReason
): Promise<SettingsUsage> {
	if (!enabled) return { status: 'not_available' };
	try {
		const usage = await getPersonalizedUsage(userId, accessReason);
		return {
			status: 'available',
			usedCredits: formatCreditsFromMilli(usage.used),
			limitCredits: formatCreditsFromMilli(usage.limit),
			remainingCredits: formatCreditsFromMilli(usage.remaining),
			warning: getPersonalizedUsageWarning(usage)
		};
	} catch {
		return { status: 'unavailable' };
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [userProfile, planAccess, freeBetaEnabled] = await Promise.all([
		getUserCourses(userId),
		getPlanAccessForRequest(locals, userId),
		isSuperFreeBetaEnabled()
	]);
	const [profile, billing, usage] = await Promise.all([
		getTutorProfileViewForRequest(locals, userId),
		getSuperBillingView(userId),
		readSettingsUsage(userId, hasPaidCapability(planAccess, 'coach'), planAccess.accessReason)
	]);

	return {
		selectedCourses: userProfile,
		planAccess,
		freeBetaEnabled,
		profile,
		usage,
		billing
	};
};

export const actions: Actions = {
	updateCourses: async ({ request, locals }) => {
		const formData = await request.formData();
		const courses = formData
			.getAll('courses')
			.filter((course): course is string => typeof course === 'string' && validCourses.has(course));

		if (courses.length === 0) {
			return fail(400, { courseError: 'Choose at least one class.' });
		}

		await updateUserCourses(locals.userId!, courses);

		return { success: true };
	}
};
