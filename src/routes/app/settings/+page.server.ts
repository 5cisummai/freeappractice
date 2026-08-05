import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { getPersonalizedUsage, getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { SuperBillingAccess } from '$lib/super/models.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { findUserProfileOrFail } from '$lib/users/profile.server.js';

const validSubjects = new Set(getCourses().map((course) => course.name));

type SettingsUsage =
	| { status: 'available'; used: number; remaining: number; warning: 80 | 95 | null }
	| { status: 'unavailable' }
	| { status: 'not_available' };

async function readSettingsUsage(userId: string, enabled: boolean): Promise<SettingsUsage> {
	if (!enabled) return { status: 'not_available' };
	try {
		const usage = await getPersonalizedUsage(userId);
		return {
			status: 'available',
			used: usage.used,
			remaining: usage.remaining,
			warning: getPersonalizedUsageWarning(usage)
		};
	} catch {
		return { status: 'unavailable' };
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [userProfile, entitlements] = await Promise.all([
		findUserProfileOrFail(userId, 'subjects'),
		getEntitlements(userId)
	]);
	const [profile, billing, usage] = await Promise.all([
		getTutorProfileView(userId),
		SuperBillingAccess.findOne({ userId, plan: 'super' }).sort({ updatedAt: -1 }).lean().exec(),
		readSettingsUsage(userId, entitlements.personalizedTutor)
	]);

	return {
		selectedSubjects: userProfile.subjects ?? [],
		entitlements,
		profile,
		usage,
		billing: billing
			? {
					status: billing.status,
					periodStart: billing.periodStart?.toISOString() ?? null,
					periodEnd: billing.periodEnd?.toISOString() ?? null,
					cancelAt: billing.cancelAt?.toISOString() ?? null,
					cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
					hasCustomer: Boolean(billing.stripeCustomerId)
				}
			: null
	};
};

export const actions: Actions = {
	updateSubjects: async ({ request, locals }) => {
		const formData = await request.formData();
		const subjects = formData
			.getAll('subjects')
			.filter(
				(subject): subject is string => typeof subject === 'string' && validSubjects.has(subject)
			);

		if (subjects.length === 0) {
			return fail(400, { subjectError: 'Choose at least one class.' });
		}

		const userProfile = await findUserProfileOrFail(locals.userId!, 'subjects');
		userProfile.subjects = subjects;
		await userProfile.save();

		return { success: true };
	}
};
