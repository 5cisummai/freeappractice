export const ONBOARDING_COOKIE_NAME = 'onboarding-hints';
export const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ONBOARDING_INTENT_COOKIE_NAME = 'onboarding-intent';
export const ONBOARDING_INTENT_COOKIE_MAX_AGE = 60 * 60 * 24;
export const ONBOARDING_GOALS = [
	'score_higher',
	'exam_prep',
	'weak_topics',
	'stay_consistent'
] as const;

export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

export type OnboardingIntent = 'free' | 'super';

export type OnboardingState =
	| { status: 'unset'; subjects: string[]; goals: OnboardingGoal[] }
	| { status: 'pending'; subjects: string[]; goals: OnboardingGoal[] }
	| { status: 'complete'; subjects: string[]; goals: OnboardingGoal[] };

function validGoals(value: unknown): OnboardingGoal[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(goal): goal is OnboardingGoal =>
			typeof goal === 'string' && (ONBOARDING_GOALS as readonly string[]).includes(goal)
	);
}

export function readOnboardingState(value: string | undefined): OnboardingState {
	if (!value) return { status: 'unset', subjects: [], goals: [] };
	if (value === 'pending') return { status: 'pending', subjects: [], goals: [] };
	if (value === 'complete') return { status: 'complete', subjects: [], goals: [] };

	try {
		const parsed = JSON.parse(value) as {
			status?: string;
			subjects?: unknown;
			goals?: unknown;
		};
		if (parsed.status !== 'complete' || !Array.isArray(parsed.subjects)) {
			return { status: 'unset', subjects: [], goals: [] };
		}

		return {
			status: 'complete',
			subjects: parsed.subjects.filter((subject): subject is string => typeof subject === 'string'),
			goals: validGoals(parsed.goals)
		};
	} catch {
		return { status: 'unset', subjects: [], goals: [] };
	}
}

export function serializeCompletedOnboarding(
	subjects: string[] = [],
	goals: OnboardingGoal[] = []
): string {
	if (subjects.length === 0 && goals.length === 0) return 'complete';
	return JSON.stringify({ status: 'complete', subjects, goals });
}

export function readOnboardingIntent(value: string | undefined): OnboardingIntent {
	return value === 'super' ? 'super' : 'free';
}

/** Used to carry the user's Super entry point through email and OAuth redirects. */
export function markOnboardingIntentInBrowser(intent: OnboardingIntent): void {
	if (typeof document === 'undefined') return;

	document.cookie = `${ONBOARDING_INTENT_COOKIE_NAME}=${intent}; path=/; max-age=${ONBOARDING_INTENT_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Used before an email verification or OAuth redirect completes. */
export function markOnboardingPendingInBrowser(): void {
	if (typeof document === 'undefined') return;

	document.cookie = `${ONBOARDING_COOKIE_NAME}=pending; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE}; SameSite=Lax`;
}
