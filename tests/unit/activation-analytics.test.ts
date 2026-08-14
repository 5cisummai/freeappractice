import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_CONSENT_KEY } from '$lib/analytics-consent';
import { captureFirstAnswerSubmitted } from '$lib/client/activation-analytics';

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
	});

	it('does not queue the first answer before analytics consent', async () => {
		const localStorage = createStorage();
		vi.stubGlobal('window', { localStorage });
		vi.stubGlobal('localStorage', localStorage);

		captureFirstAnswerSubmitted({
			apClass: 'AP Biology',
			unit: 'Unit 1',
			isCorrect: true,
			timeTakenMs: 1000
		});

		expect(capturePostHogEvent).not.toHaveBeenCalled();
	});

	it('captures only once after consent is granted', async () => {
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
	});
});
