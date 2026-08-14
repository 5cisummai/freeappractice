import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCourses } from '$lib/catalog/ap-classes.js';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getPersonalizedUsage, getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';
import { getSuperBillingView } from '$lib/super/billing.server';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';
import { hasPaidCapability } from '$lib/super/types';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import { getUserSubjects, updateUserSubjects } from '$lib/users/model.server.js';
import {
	getAssistantFeaturesEnabledForRequest,
	setAssistantFeaturesEnabled
} from '$lib/users/assistant-features.server';

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
	const [userProfile, planAccess, freeBetaEnabled, assistantFeaturesEnabled] = await Promise.all([
		getUserSubjects(userId),
		getPlanAccessForRequest(locals, userId),
		isSuperFreeBetaEnabled(),
		getAssistantFeaturesEnabledForRequest(locals, userId)
	]);
	const [profile, billing, usage] = await Promise.all([
		getTutorProfileViewForRequest(locals, userId),
		getSuperBillingView(userId),
		readSettingsUsage(userId, hasPaidCapability(planAccess, 'personalizedTutor'))
	]);

	return {
		selectedSubjects: userProfile,
		assistantFeaturesEnabled,
		planAccess,
		freeBetaEnabled,
		profile,
		usage,
		billing
	};
};

export const actions: Actions = {
	updateAssistantFeatures: async ({ request, locals }) => {
		const formData = await request.formData();
		const rawEnabled = formData.get('enabled');
		if (rawEnabled !== 'true' && rawEnabled !== 'false') {
			return fail(400, { assistantFeaturesError: 'A valid assistant setting is required.' });
		}
		await setAssistantFeaturesEnabled(locals.userId!, rawEnabled === 'true');
		return { assistantFeaturesUpdated: true };
	},
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
