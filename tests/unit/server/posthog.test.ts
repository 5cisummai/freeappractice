import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureImmediate, posthogOptions, waitUntil } = vi.hoisted(() => ({
	captureImmediate: vi.fn(() => Promise.resolve()),
	posthogOptions: vi.fn(),
	waitUntil: vi.fn()
}));

vi.mock('posthog-node', () => ({
	PostHog: class MockPostHog {
		constructor(_token: string, options: Record<string, unknown>) {
			posthogOptions(options);
		}

		captureImmediate() {
			return captureImmediate();
		}
	}
}));
vi.mock('@vercel/functions', () => ({ waitUntil }));
vi.mock('$app/environment', () => ({ building: false, dev: false }));
vi.mock('$env/static/public', () => ({
	PUBLIC_POSTHOG_PROJECT_TOKEN: 'test-token',
	PUBLIC_POSTHOG_HOST: 'https://posthog.test'
}));

import { captureAnonymousServerMetric } from '$lib/server/posthog';

describe('server PostHog capture', () => {
	beforeEach(() => {
		captureImmediate.mockClear();
		posthogOptions.mockClear();
		waitUntil.mockClear();
	});

	it('bounds waitUntil-backed captures below the short Vercel function budget', () => {
		captureAnonymousServerMetric('question_request', { http_status: 200 });

		expect(posthogOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				requestTimeout: 1000,
				fetchRetryCount: 0
			})
		);
		expect(captureImmediate).toHaveBeenCalledOnce();
		expect(waitUntil).toHaveBeenCalledOnce();
	});
});
