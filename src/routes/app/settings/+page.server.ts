import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getPersonalizedUsage, getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { SuperBillingAccess } from '$lib/super/models.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import { getUserSubjects, updateUserSubjects } from '$lib/users/model.server.js';

const validSubjects = new Set(getCourses().map((course) => course.name));

type SettingsUsage =
	| { status: 'available'; used: number; limit: number; remaining: number; warning: 80 | 95 | null }
	| { status: 'unavailable' }
	| { status: 'not_available' };

async function readSettingsUsage(userId: string, enabled: boolean): Promise<SettingsUsage> {
	if (!enabled) return { status: 'not_available' };
	try {
		const usage = await getPersonalizedUsage(userId);
		return {
			status: 'available',
			used: usage.used,
			limit: usage.limit,
			remaining: usage.remaining,
			warning: getPersonalizedUsageWarning(usage)
		};
	} catch {
		return { status: 'unavailable' };
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [userProfile, entitlements, freeBetaEnabled] = await Promise.all([
		getUserSubjects(userId),
		getEntitlements(userId),
		isSuperFreeBetaEnabled()
	]);
	const [profile, billing, usage] = await Promise.all([
		getTutorProfileViewForRequest(locals, userId),
		SuperBillingAccess.findOne({ userId, plan: 'super' }).sort({ updatedAt: -1 }).lean().exec(),
		readSettingsUsage(userId, entitlements.personalizedTutor)
	]);

	return {
		selectedSubjects: userProfile,
		entitlements,
		freeBetaEnabled,
		profile,
		usage,
		billing: billing
			? {
					status: billing.status,
					billingIssue: billing.billingIssue ?? null,
					subscriptionId: billing.stripeSubscriptionId ?? null,
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

		await updateUserSubjects(locals.userId!, subjects);

		return { success: true };
	}
};
