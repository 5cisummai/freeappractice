import { hasAnalyticsConsent } from '$lib/client/analytics-consent';
import {
	daysBetweenCalendarDays,
	latencyBucket,
	localCalendarDay,
	type QuestionFailureKind,
	type QuestionSource
} from '$lib/client/activation-funnel-metrics';
import { capturePostHogEvent } from '$lib/client/posthog-analytics';

export {
	classifyQuestionFailure,
	daysBetweenCalendarDays,
	latencyBucket,
	localCalendarDay,
	QuestionRequestError,
	questionSourceFromCachedFlag,
	type LatencyBucket,
	type QuestionFailureKind,
	type QuestionSource
} from '$lib/client/activation-funnel-metrics';

/** localStorage key for the anonymous activation journey (consent-gated). */
export const ACTIVATION_JOURNEY_KEY = 'ph_activation_journey_key';
const FIRST_ANSWER_FLAG_KEY = 'ph_activation_first_answer_sent';
const LAST_AUTH_VISIT_DAY_KEY = 'ph_last_auth_visit_day';

/** Activation funnel event names (see docs/analytics-activation-funnel.md). */
export const ACTIVATION_EVENTS = {
	landingPageViewed: 'landing_page_viewed',
	practiceSelectorUsed: 'practice_selector_used',
	generateClicked: 'generate_clicked',
	questionRequestSucceeded: 'question_request_succeeded',
	questionRequestFailed: 'question_request_failed',
	questionRendered: 'question_rendered',
	firstAnswerSubmitted: 'first_answer_submitted',
	signupStarted: 'signup_started',
	signupCompleted: 'signup_completed',
	authenticatedStudentReturned: 'authenticated_student_returned'
} as const;

function canUseStorage(): boolean {
	return typeof window !== 'undefined' && hasAnalyticsConsent();
}

/** Non-identifying journey key shared across funnel events when consent is granted. */
export function getOrCreateJourneyKey(): string | undefined {
	if (!canUseStorage()) return undefined;

	try {
		const existing = localStorage.getItem(ACTIVATION_JOURNEY_KEY)?.trim();
		if (existing) return existing;

		const key = crypto.randomUUID();
		localStorage.setItem(ACTIVATION_JOURNEY_KEY, key);
		return key;
	} catch {
		return undefined;
	}
}

function withJourney(
	properties: Record<string, unknown> = {}
): Record<string, unknown> | undefined {
	if (!hasAnalyticsConsent()) return undefined;

	const journeyKey = getOrCreateJourneyKey();
	return {
		...properties,
		...(journeyKey ? { journey_key: journeyKey } : {})
	};
}

function captureActivation(event: string, properties: Record<string, unknown> = {}): void {
	const props = withJourney(properties);
	if (!props) return;
	capturePostHogEvent(event, props);
}

export function captureLandingPageViewed(): void {
	captureActivation(ACTIVATION_EVENTS.landingPageViewed, { path: '/' });
}

export function capturePracticeSelectorUsed(apClass: string, unit: string): void {
	if (!apClass.trim()) return;
	captureActivation(ACTIVATION_EVENTS.practiceSelectorUsed, {
		ap_class: apClass,
		unit
	});
}

export function captureGenerateClicked(apClass: string, unit: string): void {
	captureActivation(ACTIVATION_EVENTS.generateClicked, {
		ap_class: apClass,
		unit
	});
}

export function captureQuestionRequestSucceeded(opts: {
	apClass: string;
	unit: string;
	source: QuestionSource;
	latencyMs: number;
}): void {
	captureActivation(ACTIVATION_EVENTS.questionRequestSucceeded, {
		ap_class: opts.apClass,
		unit: opts.unit,
		source: opts.source,
		latency_ms: opts.latencyMs,
		latency_bucket: latencyBucket(opts.latencyMs)
	});
}

export function captureQuestionRequestFailed(opts: {
	apClass: string;
	unit: string;
	failureKind: QuestionFailureKind;
	status?: number | null;
	latencyMs?: number;
}): void {
	captureActivation(ACTIVATION_EVENTS.questionRequestFailed, {
		ap_class: opts.apClass,
		unit: opts.unit,
		failure_kind: opts.failureKind,
		...(opts.status != null ? { status: opts.status } : {}),
		...(opts.latencyMs != null
			? { latency_ms: opts.latencyMs, latency_bucket: latencyBucket(opts.latencyMs) }
			: {})
	});
}

export function captureQuestionRendered(opts: {
	apClass: string;
	unit: string;
	source: QuestionSource;
	latencyMs: number;
}): void {
	captureActivation(ACTIVATION_EVENTS.questionRendered, {
		ap_class: opts.apClass,
		unit: opts.unit,
		source: opts.source,
		latency_ms: opts.latencyMs,
		latency_bucket: latencyBucket(opts.latencyMs)
	});
}

export function captureFirstAnswerSubmitted(opts: {
	apClass: string;
	unit: string;
	isCorrect: boolean;
	timeTakenMs: number;
}): void {
	if (!canUseStorage()) return;

	try {
		if (localStorage.getItem(FIRST_ANSWER_FLAG_KEY) === '1') return;
		localStorage.setItem(FIRST_ANSWER_FLAG_KEY, '1');
	} catch {
		// Still attempt capture if storage is unavailable mid-session.
	}

	captureActivation(ACTIVATION_EVENTS.firstAnswerSubmitted, {
		ap_class: opts.apClass,
		unit: opts.unit,
		is_correct: opts.isCorrect,
		time_taken_ms: opts.timeTakenMs,
		time_taken_bucket: latencyBucket(opts.timeTakenMs)
	});
}

export function captureSignupStarted(method?: 'email' | 'google' | 'page'): void {
	captureActivation(ACTIVATION_EVENTS.signupStarted, {
		method: method ?? 'page'
	});
}

export function captureSignupCompleted(method: 'email' | 'google'): void {
	captureActivation(ACTIVATION_EVENTS.signupCompleted, { method });
}

/**
 * Fires when an authenticated student opens the app on a later calendar day
 * than their previous recorded visit (local timezone date).
 */
export function captureAuthenticatedStudentReturnedIfNeeded(): void {
	if (!canUseStorage()) return;

	const today = localCalendarDay();
	try {
		const previous = localStorage.getItem(LAST_AUTH_VISIT_DAY_KEY);
		if (previous && previous !== today) {
			const days = daysBetweenCalendarDays(previous, today);
			captureActivation(ACTIVATION_EVENTS.authenticatedStudentReturned, {
				days_since_previous_visit: days
			});
		}
		localStorage.setItem(LAST_AUTH_VISIT_DAY_KEY, today);
	} catch {
		// ignore
	}
}
