import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandleClientError } from '@sveltejs/kit/hooks';

const mocks = vi.hoisted(() => ({
	captureSentry: vi.fn(),
	capturePostHog: vi.fn(),
	reload: vi.fn(),
	getItem: vi.fn(),
	setItem: vi.fn(),
	sentryInit: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	init: mocks.sentryInit,
	handleErrorWithSentry:
		(handler: HandleClientError): HandleClientError =>
		(input) => {
			if (input.kind === 'unknown') mocks.captureSentry(input.error);
			return handler(input);
		}
}));
vi.mock('#lib/client/posthog-analytics.js', () => ({
	initPostHogAnalytics: vi.fn(),
	capturePostHogException: mocks.capturePostHog
}));
vi.mock('#lib/sentry-config.js', () => ({ sentryEnabled: true, sentryOptions: {} }));

async function loadHooks() {
	return import('../../../src/hooks.client.js');
}

async function handle(error: Error) {
	const { handleError } = await loadHooks();
	return handleError({ kind: 'unknown', error } as Parameters<HandleClientError>[0]);
}

async function runBeforeSend(error: unknown, event: { message?: string } = {}) {
	await loadHooks();
	const options = mocks.sentryInit.mock.calls.at(-1)?.[0] as {
		beforeSend: (event: { message?: string }, hint: { originalException?: unknown }) => unknown;
	};
	return options.beforeSend(event, { originalException: error });
}

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	vi.stubGlobal('window', { location: { reload: mocks.reload }, addEventListener: vi.fn() });
	vi.stubGlobal('sessionStorage', { getItem: mocks.getItem, setItem: mocks.setItem });
});
afterEach(() => vi.unstubAllGlobals());

describe('client chunk recovery', () => {
	it.each([
		'Failed to fetch dynamically imported module: /_app/immutable/chunks/x.js',
		'Importing a module script failed',
		'error loading dynamically imported module: /_app/immutable/chunks/x.js'
	])('attempts a reload before reporting %s', async (message) => {
		await handle(new TypeError(message));
		expect(mocks.reload).toHaveBeenCalledOnce();
		expect(mocks.captureSentry).not.toHaveBeenCalled();
		expect(mocks.capturePostHog).not.toHaveBeenCalled();
	});

	it('reports a repeated failure inside the reload window', async () => {
		mocks.getItem.mockReturnValue(String(Date.now()));
		const error = new TypeError('error loading dynamically imported module: /_app/x.js');
		await handle(error);
		expect(mocks.reload).not.toHaveBeenCalled();
		expect(mocks.captureSentry).toHaveBeenCalledWith(error);
		expect(mocks.capturePostHog).toHaveBeenCalledWith(error);
	});

	it('reports the failure if session storage blocks recovery', async () => {
		mocks.setItem.mockImplementation(() => {
			throw new Error('Storage blocked');
		});
		const error = new TypeError('Importing a module script failed');
		await handle(error);
		expect(mocks.reload).not.toHaveBeenCalled();
		expect(mocks.captureSentry).toHaveBeenCalledWith(error);
		expect(mocks.capturePostHog).toHaveBeenCalledWith(error);
	});

	it.each(['Failed to fetch', 'Load failed', 'Cannot read properties of undefined'])(
		'reports %s',
		async (message) => {
			const error = new TypeError(message);
			await handle(error);
			expect(mocks.reload).not.toHaveBeenCalled();
			expect(mocks.captureSentry).toHaveBeenCalledWith(error);
			expect(mocks.capturePostHog).toHaveBeenCalledWith(error);
		}
	);

	it("reloads before reporting SvelteKit missing route-node 'component' crashes", async () => {
		await handle(new TypeError("Cannot read properties of undefined (reading 'component')"));
		expect(mocks.reload).toHaveBeenCalledOnce();
		expect(mocks.captureSentry).not.toHaveBeenCalled();
		expect(mocks.capturePostHog).not.toHaveBeenCalled();
	});

	it('reports a repeated missing-component crash inside the reload window', async () => {
		mocks.getItem.mockReturnValue(String(Date.now()));
		const error = new TypeError("Cannot read properties of undefined (reading 'component')");
		await handle(error);
		expect(mocks.reload).not.toHaveBeenCalled();
		expect(mocks.captureSentry).toHaveBeenCalledWith(error);
		expect(mocks.capturePostHog).toHaveBeenCalledWith(error);
	});
});

describe('Sentry beforeSend stale-client recovery', () => {
	it('drops the event only when a one-shot reload starts', async () => {
		const result = await runBeforeSend(
			new TypeError("Cannot read properties of undefined (reading 'component')")
		);
		expect(mocks.reload).toHaveBeenCalledOnce();
		expect(result).toBeNull();
	});

	it('still sends repeats inside the reload window', async () => {
		mocks.getItem.mockReturnValue(String(Date.now()));
		const error = new TypeError("Cannot read properties of undefined (reading 'component')");
		const event = { message: error.message };
		const result = await runBeforeSend(error, event);
		expect(mocks.reload).not.toHaveBeenCalled();
		expect(result).toBe(event);
	});

	it('passes through unrelated errors', async () => {
		const error = new TypeError('something else broke');
		const event = { message: error.message };
		const result = await runBeforeSend(error, event);
		expect(mocks.reload).not.toHaveBeenCalled();
		expect(result).toBe(event);
	});
});
