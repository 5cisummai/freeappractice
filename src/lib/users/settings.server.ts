import { isSuperFreeBetaEnabled } from '#lib/flags.js';
import {
	getPersonalizedUsage,
	getPersonalizedUsageWarning
} from '#lib/agent/usage/controls.server.js';
import { formatCreditsFromMilli } from '#lib/agent/usage/credits.js';
import { getSuperBillingView } from '#lib/billing/subscriptions.server.js';
import { hasPaidCapability, type SuperAccessReason } from '#lib/billing/types.js';
import type {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '#lib/agent/access.server.js';
import { getUserCourses } from '#lib/users/model.server.js';

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

export async function getUserSettings(
	userId: string,
	planAccess: Awaited<ReturnType<typeof getPlanAccessForRequest>>,
	profile: Awaited<ReturnType<typeof getTutorProfileViewForRequest>>
) {
	const [selectedCourses, freeBetaEnabled, billing, usage] = await Promise.all([
		getUserCourses(userId),
		isSuperFreeBetaEnabled(),
		getSuperBillingView(userId),
		readSettingsUsage(userId, hasPaidCapability(planAccess, 'coach'), planAccess.accessReason)
	]);
	return { selectedCourses, planAccess, freeBetaEnabled, profile, usage, billing };
}
