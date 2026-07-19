import { hasAnalyticsConsent } from '$lib/client/analytics-consent';
import { capturePostHogEvent } from '$lib/client/posthog-analytics';
import { classifyQuestionFailureFromStatus, type QuestionFailureKind } from '$lib/question-failure';

type LatencyBucket = '0-500ms' | '500-1000ms' | '1-2s' | '2-5s' | '5s+';
export type QuestionSource = 'cached' | 'generated';

export function latencyBucket(ms: number): LatencyBucket {
	if (!Number.isFinite(ms) || ms < 0) return '5s+';
	if (ms < 500) return '0-500ms';
	if (ms < 1000) return '500-1000ms';
	if (ms < 2000) return '1-2s';
	if (ms < 5000) return '2-5s';
	return '5s+';
}

export class QuestionRequestError extends Error {
	readonly status: number | null;
	readonly failureKind: QuestionFailureKind;

	constructor(message: string, status: number | null) {
		super(message);
		this.name = 'QuestionRequestError';
		this.status = status;
		this.failureKind = classifyQuestionFailureFromStatus(status);
	}
}

export function questionSourceFromCachedFlag(cached: unknown): QuestionSource {
	return cached === true ? 'cached' : 'generated';
}

export function localCalendarDay(date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function daysBetweenCalendarDays(earlier: string, later: string): number {
	const a = Date.parse(`${earlier}T00:00:00`);
	const b = Date.parse(`${later}T00:00:00`);
	if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
	return Math.round((b - a) / 86_400_000);
}

const ACTIVATION_JOURNEY_KEY = 'ph_activation_journey_key';
const FIRST_ANSWER_FLAG_KEY = 'ph_activation_first_answer_sent';
const LAST_AUTH_VISIT_DAY_KEY = 'ph_last_auth_visit_day';

const ACTIVATION_EVENTS = {
	landingPageViewed: 'landing_page_viewed',
	practiceSelectorUsed: 'practice_selector_used',
	generateClicked: 'generate_clicked',
	questionRequestSucceeded: 'question_request_succeeded',
	questionRequestFailed: 'question_request_failed',
	firstAnswerSubmitted: 'first_answer_submitted',
	signupStarted: 'signup_started',
	signupCompleted: 'signup_completed',
	authenticatedStudentReturned: 'authenticated_student_returned'
} as const;

function canUseStorage(): boolean {
	return typeof window !== 'undefined' && hasAnalyticsConsent();
}

function getOrCreateJourneyKey(): string | undefined {
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
