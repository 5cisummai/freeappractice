import type { RequestEvent } from '@sveltejs/kit';
import { isSuperCoachEnabled, isSuperInsightsEnabled, isSuperMemoryEnabled } from '$lib/flags';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';
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

/** Request-local billing read shared by every Super product in this request. */
export function getPlanAccessForRequest(
	locals: Pick<App.Locals, 'planAccess'>,
	userId: string
): Promise<PlanAccess> {
	return (locals.planAccess ??= import('$lib/super/billing.server').then(({ getPlanAccess }) =>
		getPlanAccess(userId)
	));
}

/** Request-local profile read shared by Super access and product pages. */
export function getTutorProfileViewForRequest(
	locals: Pick<App.Locals, 'tutorProfileView'>,
	userId: string
): Promise<TutorProfileView> {
	return (locals.tutorProfileView ??= import('$lib/super/profile.server').then(
		({ getTutorProfileView }) => getTutorProfileView(userId)
	));
}

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

