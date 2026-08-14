import type { RequestEvent } from '@sveltejs/kit';
import { isSuperCoachEnabled, isSuperInsightsEnabled, isSuperMemoryEnabled } from '$lib/flags';
import { getAssistantFeaturesEnabledForRequest } from '$lib/users/assistant-features.server';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import {
	hasPaidCapability,
	type PaidCapability,
	type PlanAccess,
	type TutorProfileView
} from '$lib/super/types';

export type SuperFeature = 'personalizedTutor' | 'coach' | 'aiInsights' | 'studyPlans' | 'memory';

const FEATURE_FLAGS: Partial<Record<SuperFeature, () => Promise<boolean>>> = {
	coach: isSuperCoachEnabled,
	aiInsights: isSuperInsightsEnabled,
	studyPlans: isSuperInsightsEnabled,
	memory: isSuperMemoryEnabled
};

const FEATURE_CAPABILITIES: Record<SuperFeature, PaidCapability> = {
	personalizedTutor: 'personalizedTutor',
	coach: 'coach',
	aiInsights: 'aiInsights',
	studyPlans: 'studyPlans',
	memory: 'memory'
};

export type AuthorizedFeatureContext = {
	userId: string;
	planAccess: PlanAccess;
	profile: TutorProfileView;
};

export type FeatureAccessDecision =
	| ({ allowed: true } & AuthorizedFeatureContext)
	| {
			allowed: false;
			status: 403 | 503;
			code: 'feature_disabled' | 'assistant_disabled' | 'subscription_required' | 'age_required';
			message: string;
	  };

/** Resolve request-path access in flag, plan, and age order. */
export async function authorizeFeatureRequest(
	event: Pick<RequestEvent, 'locals'>,
	userId: string,
	feature: SuperFeature
): Promise<FeatureAccessDecision> {
	const flag = FEATURE_FLAGS[feature];
	if (flag && !(await flag())) {
		return {
			allowed: false,
			status: 503,
			code: 'feature_disabled',
			message: featureUnavailableMessage(feature)
		};
	}

	if (
		feature !== 'memory' &&
		!(await getAssistantFeaturesEnabledForRequest(event.locals, userId))
	) {
		return {
			allowed: false,
			status: 403,
			code: 'assistant_disabled',
			message: 'Assistant features are disabled for this account.'
		};
	}

	const planAccess = await getPlanAccessForRequest(event.locals, userId);
	if (!hasPaidCapability(planAccess, FEATURE_CAPABILITIES[feature])) {
		return {
			allowed: false,
			status: 403,
			code: 'subscription_required',
			message: 'Super subscription required'
		};
	}

	const profile = await getTutorProfileViewForRequest(event.locals, userId);
	if (!profile.ageConfirmedAt) {
		return {
			allowed: false,
			status: 403,
			code: 'age_required',
			message: 'You must be at least 13 to use Super features.'
		};
	}

	return { allowed: true, userId, planAccess, profile };
}

function featureUnavailableMessage(feature: SuperFeature): string {
	if (feature === 'coach') return 'Coach is temporarily unavailable.';
	if (feature === 'memory') return 'Tutor memory is temporarily unavailable.';
	if (feature === 'studyPlans') return 'Study plans are temporarily unavailable.';
	if (feature === 'aiInsights') return 'Insights are temporarily unavailable.';
	return 'Super Tutor is temporarily unavailable.';
}

/** Compatibility view for callers that only need the old allowed/reason shape. */
export type SuperFeatureAccess =
	| { allowed: true }
	| { allowed: false; reason: 'subscription' | 'age' | 'feature_disabled' | 'assistant_disabled' };

export async function getSuperFeatureAccess(
	userId: string,
	feature: SuperFeature,
	event?: Pick<RequestEvent, 'locals'>
): Promise<SuperFeatureAccess> {
	const request = event ?? { locals: {} as App.Locals };
	const access = await authorizeFeatureRequest(request, userId, feature);
	return access.allowed
		? { allowed: true }
		: {
				allowed: false,
				reason:
					access.code === 'age_required'
						? 'age'
						: access.code === 'assistant_disabled'
							? 'assistant_disabled'
							: access.code === 'feature_disabled'
								? 'feature_disabled'
								: 'subscription'
			};
}

export function superFeatureAccessMessage(
	access: Exclude<SuperFeatureAccess, { allowed: true }>,
	label: string
): string {
	if (access.reason === 'assistant_disabled')
		return 'Assistant features are disabled for this account.';
	if (access.reason === 'feature_disabled') return `${label} is temporarily unavailable.`;
	return access.reason === 'subscription'
		? 'Super subscription required'
		: 'You must be at least 13 to use Super features.';
}
