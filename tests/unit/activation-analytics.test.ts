import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_CONSENT_KEY } from '$lib/analytics-consent';
import {
	captureFirstAnswerSubmitted,
	captureLandingPageViewed,
	captureUserLoggedIn,
	persistActivationAnalyticsAfterConsent,
	resetActivationAnalyticsForTests
} from '$lib/client/activation-analytics';

const { capturePostHogEvent } = vi.hoisted(() => ({
	capturePostHogEvent: vi.fn()
}));

vi.mock('$lib/client/posthog-analytics', () => ({
	capturePostHogEvent
}));

function createStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

describe('captureFirstAnswerSubmitted', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		capturePostHogEvent.mockReset();
		resetActivationAnalyticsForTests();
	});

	it('queues the first answer before analytics consent', () => {
		const localStorage = createStorage();
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		captureFirstAnswerSubmitted({
			apClass: 'AP Biology',
			unit: 'Unit 1',
			isCorrect: true,
			timeTakenMs: 1000
		});

		expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
		expect(capturePostHogEvent.mock.calls[0]?.[0]).toBe('first_answer_submitted');
		expect(localStorage.getItem('ph_activation_first_answer_sent')).toBeNull();
	});

	it('captures only once after consent is granted', () => {
		const localStorage = createStorage();
		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		const answer = {
			apClass: 'AP Biology',
			unit: 'Unit 1',
			isCorrect: true,
			timeTakenMs: 1000
		};

		captureFirstAnswerSubmitted(answer);
		captureFirstAnswerSubmitted(answer);

		expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem('ph_activation_first_answer_sent')).toBe('1');
	});

	it('persists the first-answer flag when consent is granted later', () => {
		const localStorage = createStorage();
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		captureFirstAnswerSubmitted({
			apClass: 'AP Biology',
			unit: 'Unit 1',
			isCorrect: true,
			timeTakenMs: 1000
		});
		expect(localStorage.getItem('ph_activation_first_answer_sent')).toBeNull();

		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
		persistActivationAnalyticsAfterConsent();

		expect(localStorage.getItem('ph_activation_first_answer_sent')).toBe('1');
	});
});

describe('journey_key', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		capturePostHogEvent.mockReset();
		resetActivationAnalyticsForTests();
	});

	it('attaches an in-memory journey_key to pre-consent queued events', () => {
		const localStorage = createStorage();
		vi.stubGlobal('crypto', { randomUUID: () => 'journey-test-key' });
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		captureLandingPageViewed();

		expect(capturePostHogEvent).toHaveBeenCalledWith(
			'landing_page_viewed',
			expect.objectContaining({ journey_key: 'journey-test-key', path: '/' })
		);
		expect(localStorage.getItem('ph_activation_journey_key')).toBeNull();
	});

	it('reuses the same journey_key after consent is granted', () => {
		const localStorage = createStorage();
		vi.stubGlobal('crypto', { randomUUID: () => 'journey-test-key' });
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		captureLandingPageViewed();
		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
		persistActivationAnalyticsAfterConsent();
		captureLandingPageViewed();

		expect(localStorage.getItem('ph_activation_journey_key')).toBe('journey-test-key');
		expect(capturePostHogEvent.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({ journey_key: 'journey-test-key' })
		);
	});
});

describe('captureUserLoggedIn', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		capturePostHogEvent.mockReset();
		resetActivationAnalyticsForTests();
	});

	it('fires once per session even when called again', () => {
		vi.stubGlobal('window', { localStorage: createStorage() });

		captureUserLoggedIn('google');
		captureUserLoggedIn('google_one_tap');

		expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
		expect(capturePostHogEvent).toHaveBeenCalledWith('user_logged_in', { method: 'google' });
	});
});
